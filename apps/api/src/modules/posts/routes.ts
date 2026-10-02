import { createRoute } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import type { Post as Row } from "@hyperfocus/db";
import { CreatePostInput, PolishInput, Polished, Post, PostIdeas, PostIdeasInput, Rewrite, RewriteInput, SchedulePostInput, UpdatePostInput } from "@hyperfocus/shared";
import type { AppDeps } from "../../app.ts";
import { IdParam, body, crudRouter, json, pathId, problem } from "../../http/crud.ts";
import { compact, httpError, orNull, parseDate } from "../../types.ts";
import { autoPostProblem } from "./rules.ts";

// LinkedIn posts (P2-15): drafts, the AI helpers for them, publishing now (through the SocialPublisher port, n8n today),
// marking as posted by hand, and scheduling. Same answers as the Express routes had, plus the P2 fixes: a post that
// doesn't exist is a 404 "Post not found." everywhere (changing, deleting, publishing, marking or unscheduling one used
// to be a 500, or a misleading "The draft is empty.").

const POST_404 = "Post not found.";

export function postsRouter({ prisma, events, ai, publisher }: AppDeps) {
  const app = crudRouter({
    path: "/api/posts",
    tag: "Posts",
    name: "post",
    item: Post,
    create: CreatePostInput,
    update: UpdatePostInput,
    notFound: POST_404,
    store: {
      list: () => prisma.post.findMany({ orderBy: { updatedAt: "desc" } }),
      get: (id) => prisma.post.findUnique({ where: { id } }),
      create: ({ thought, draft, noteId }) => prisma.post.create({ data: { thought, draft: draft ?? "", noteId: noteId ?? null } }),
      update: (id, data) => orNull(prisma.post.update({ where: { id }, data: compact(data) })),
      remove: async (id) => (await prisma.post.deleteMany({ where: { id } })).count > 0,
    },
  });
  const tags = ["Posts"];
  const find = async (raw: string | undefined) => {
    const post = await prisma.post.findUnique({ where: { id: pathId(raw, POST_404) } });
    if (!post) throw httpError(404, POST_404);
    return post;
  };
  /** A post can't be sent twice, or while it is being sent. */
  const notSentYet = (post: Row) => {
    if (post.status === "posted") throw httpError(409, "This post is already posted.");
    if (post.status === "posting") throw httpError(409, "This post is being sent right now.");
  };
  const markPosted = async (id: number) => {
    const posted = await prisma.post.update({ where: { id }, data: { status: "posted", postedAt: new Date(), lastError: "" } });
    await events.publish("PostPublished", { postId: id });
    return posted;
  };
  const one = { params: IdParam };
  const answers = (ok: string) => ({ 200: json(Post, ok), 404: problem("No such post") });

  app.openapi(
    createRoute({
      method: "post", path: "/api/posts/{id}/publish", tags, summary: "Publish now (LinkedIn, through n8n)", request: one,
      responses: { ...answers("The post, now posted"), 400: problem("The draft is empty"), 409: problem("Already posted, being sent, or posting isn't set up"), 502: problem("n8n failed; the post is unchanged") },
    }),
    async (c) => {
      const post = await find(c.req.param("id"));
      if (!post.draft.trim()) throw httpError(400, "The draft is empty.");
      notSentYet(post);
      if (!publisher.configured()) throw httpError(409, "n8n_not_configured"); // the website shows the copy fallback for this
      const r = await publisher.publish(post);
      if (!r.ok) throw httpError(502, r.error);
      return c.json(await markPosted(post.id), 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/posts/{id}/mark-posted", tags, summary: "She posted it by hand", request: one, responses: answers("The post, now posted") }),
    async (c) => c.json(await markPosted((await find(c.req.param("id"))).id), 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/posts/{id}/schedule", tags, summary: "Post it automatically at a time (a minute or more from now)",
      request: { ...one, body: body(SchedulePostInput) },
      responses: { ...answers("The post, scheduled"), 400: problem("Not a good time, or the draft can't be auto-posted"), 409: problem("Already posted or being sent") },
    }),
    async (c) => {
      const post = await find(c.req.param("id"));
      const when = parseDate(c.req.valid("json").scheduledAt ?? Number.NaN);
      if (!when) throw httpError(400, "Pick a valid date and time.");
      if (when.getTime() < Date.now() + 60000) throw httpError(400, "Pick a time at least a minute from now.");
      notSentYet(post);
      const problemWithDraft = autoPostProblem(post.draft);
      if (problemWithDraft) throw httpError(400, problemWithDraft);
      if (!publisher.configured()) throw httpError(400, "Auto-posting needs n8n connected (N8N_WEBHOOK_URL).");
      const data = { status: "scheduled", scheduledAt: when, attempts: 0, lastError: "", lastAttemptAt: null };
      return c.json(await prisma.post.update({ where: { id: post.id }, data }), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/posts/{id}/unschedule", tags, summary: "Cancel the scheduled time (back to a draft)", request: one,
      responses: { ...answers("The post, a draft again"), 409: problem("It's being sent right now") },
    }),
    async (c) => {
      const post = await find(c.req.param("id"));
      if (post.status === "posting") throw httpError(409, "It's being sent right now, too late to cancel.");
      return c.json(await prisma.post.update({ where: { id: post.id }, data: { status: "draft", scheduledAt: null, attempts: 0, lastError: "" } }), 200);
    },
  );

  // ---------- the AI helpers for posts ----------
  const aiTags = ["AI"];
  app.openapi(
    createRoute({
      method: "post", path: "/api/ai/rewrite", tags: aiTags, summary: "AI: a LinkedIn post from her thought, or an edit following her instruction",
      request: { body: body(RewriteInput) }, responses: { 200: json(Rewrite, "The draft, other hooks and ideas"), 400: problem("No thought") },
    }),
    async (c) => c.json(await ai.run(prompts.rewritePost, c.req.valid("json")), 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/ai/polish", tags: aiTags, summary: "AI: the smallest spelling and grammar fixes",
      request: { body: body(PolishInput) }, responses: { 200: json(Polished, "The fixed text and the list of changes"), 400: problem("Nothing to polish"), 502: problem("The AI changed too much") },
    }),
    async (c) => c.json(await ai.run(prompts.polishDraft, { draft: c.req.valid("json") }), 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/ai/post-ideas", tags: aiTags, summary: "AI: 3 post ideas from her study notes",
      request: { body: body(PostIdeasInput) }, responses: { 200: json(PostIdeas, "Three ideas"), 400: problem("Not enough notes") },
    }),
    async (c) => c.json({ ideas: await ai.run(prompts.postIdeas, c.req.valid("json")) }, 200),
  );

  return app;
}

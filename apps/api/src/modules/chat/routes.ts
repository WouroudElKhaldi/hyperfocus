import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import type { ChatThread as ThreadRow } from "@hyperfocus/db";
import { ChatInput, ChatMessage, ChatThread, ChatThreadRow, RenameThreadInput } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, Ok, body, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { activeMs, type Db, errorInfo, httpError, orNull } from "../../types.ts";
import { CRISIS_FALLBACK, isCrisis } from "./crisis.ts";

// The support chat (P2-18). Conversations are saved as threads; a "temporary" chat is sent with its own history and is
// never written to the database. Same answers as the Express routes had, plus:
// - the safeguard: a crisis message always comes back flagged with a safe reply, even when the AI fails (it used to be an error);
// - the P2 fix: renaming a chat that doesn't exist is a 404 (it was a 500).

const THREAD_404 = "That chat was not found.";

const threadTitle = (text: unknown) => {
  const t = String(text).replace(/\s+/g, " ").trim();
  return t.length > 44 ? `${t.slice(0, 41).trimEnd()}...` : t || "New chat";
};

/** Messages from before threads existed become one earlier conversation. */
async function adoptOldMessages(prisma: Db) {
  const old = await prisma.chatMessage.findMany({ where: { threadId: null }, orderBy: { id: "asc" } });
  const oldest = old[0], newest = old.at(-1);
  if (!oldest || !newest) return;
  const first = old.find((m) => m.role === "user");
  const th = await prisma.chatThread.create({ data: { title: first ? threadTitle(first.content) : "Earlier chat", createdAt: oldest.createdAt, updatedAt: newest.createdAt } });
  await prisma.chatMessage.updateMany({ where: { threadId: null }, data: { threadId: th.id } });
}

/** A little context about her day, so the replies fit. It is used lightly and never shown back. */
async function dayContext(prisma: Db) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [tasks, today, running, prof] = await Promise.all([
    prisma.task.findMany({ where: { done: false, OR: [{ today: true }, { dueDay: new Date().toISOString().slice(0, 10) }] }, take: 5 }),
    prisma.studySession.findMany({ where: { startedAt: { gte: start }, endedAt: { not: null } } }),
    prisma.studySession.findFirst({ where: { endedAt: null } }),
    prisma.profile.findFirst(),
  ]);
  const studied = Math.round(today.reduce((t, x) => t + activeMs(x) / 60000, 0));
  const about = prof
    ? `. Her name is ${prof.name || "(not given)"}${prof.role ? `; she works as ${prof.role}` : ""}${prof.about ? `; about her: ${prof.about}` : ""}${prof.helps ? `; what helps her, in her own words: ${prof.helps}` : ""}`
    : "";
  return `it is ${new Date().toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" })}; studied today: ${studied} min${running ? " (a study session is running now)" : ""}; tasks for today: ${tasks.map((t) => t.title).join("; ") || "none listed"}${about}`;
}

const ChatReply = z
  .object({ user: ChatMessage, assistant: ChatMessage, crisis: z.boolean(), thread: ChatThread.optional(), temporary: z.literal(true).optional() })
  .openapi("ChatReply", { description: "`crisis: true` means: show urgent help next to the reply." });

export function chatRouter({ prisma, ai, log }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const tags = ["Support chat"];
  const idOf = (raw: string | undefined) => pathId(raw, THREAD_404);

  // ---------- threads ----------
  app.openapi(
    createRoute({ method: "get", path: "/api/chat/threads", tags, summary: "The conversations, most recent first", responses: { 200: json(z.array(ChatThreadRow), "The threads with their message counts") } }),
    async (c) => {
      await adoptOldMessages(prisma);
      const rows = await prisma.chatThread.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], include: { _count: { select: { messages: true } } } });
      return c.json(rows.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, createdAt: t.createdAt, count: t._count.messages })), 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/chat/threads", tags, summary: "Start an empty conversation", responses: { 200: json(ChatThread, "The new thread") } }),
    async (c) => c.json(await prisma.chatThread.create({ data: {} }), 200),
  );
  app.openapi(
    createRoute({
      method: "get", path: "/api/chat/threads/{id}", tags, summary: "One conversation with its messages", request: { params: IdParam },
      responses: { 200: json(z.object({ thread: ChatThread, messages: z.array(ChatMessage) }), "The thread"), 404: problem("No such chat") },
    }),
    async (c) => {
      const t = await prisma.chatThread.findUnique({ where: { id: idOf(c.req.param("id")) } });
      if (!t) throw httpError(404, THREAD_404);
      return c.json({ thread: t, messages: await prisma.chatMessage.findMany({ where: { threadId: t.id }, orderBy: { id: "asc" } }) }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/chat/threads/{id}", tags, summary: "Rename a conversation", request: { params: IdParam, body: body(RenameThreadInput) },
      responses: { 200: json(ChatThread, "The thread"), 400: problem("No name"), 404: problem("No such chat") },
    }),
    async (c) => {
      const t = await orNull(prisma.chatThread.update({ where: { id: idOf(c.req.param("id")) }, data: { title: c.req.valid("json").title } }));
      if (!t) throw httpError(404, THREAD_404);
      return c.json(t, 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/chat/threads/{id}", tags, summary: "Delete a conversation (already gone is fine)", request: { params: IdParam }, responses: { 200: json(Ok, "Deleted") } }),
    async (c) => {
      const id = idOf(c.req.param("id"));
      await prisma.chatMessage.deleteMany({ where: { threadId: id } });
      await prisma.chatThread.deleteMany({ where: { id } });
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/chat/threads", tags, summary: "Delete every conversation", responses: { 200: json(Ok, "Deleted") } }),
    async (c) => {
      await prisma.chatMessage.deleteMany();
      await prisma.chatThread.deleteMany();
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------- talking ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/chat", tags, summary: "Send a message and get the companion's reply",
      request: { body: body(ChatInput) }, responses: { 200: json(ChatReply, "Her message and the reply"), 400: problem("Nothing written"), 404: problem("No such chat") },
    }),
    async (c) => {
      const { message, threadId, temporary, history: sentHistory } = c.req.valid("json");
      let thread: ThreadRow | null = null;
      let history: { role: string; content: string }[];
      if (temporary) history = sentHistory;
      else {
        thread = threadId ? await prisma.chatThread.findUnique({ where: { id: threadId } }) : null;
        if (threadId && !thread) throw httpError(404, THREAD_404);
        history = thread ? (await prisma.chatMessage.findMany({ where: { threadId: thread.id }, orderBy: { id: "desc" }, take: 24 })).reverse() : [];
      }
      const crisis = isCrisis(message);
      let reply: string;
      try {
        reply = (await ai.run(prompts.companionReply, { history, message, context: await dayContext(prisma) })).trim();
      } catch (e) {
        if (!crisis) throw e;
        // never an error instead of help: the safe reply, and the app shows urgent help (crisis: true)
        log.error({ err: errorInfo(e).message }, "the AI failed on a crisis message; the safe reply was sent");
        reply = CRISIS_FALLBACK;
      }
      if (temporary) {
        const now = new Date().toISOString();
        return c.json({ user: { id: `t${Date.now()}u`, role: "user", content: message, createdAt: now }, assistant: { id: `t${Date.now()}a`, role: "assistant", content: reply, createdAt: now }, crisis, temporary: true as const }, 200);
      }
      if (!thread) thread = await prisma.chatThread.create({ data: { title: threadTitle(message) } });
      else if (!history.length) thread = await prisma.chatThread.update({ where: { id: thread.id }, data: { title: threadTitle(message) } });
      const userMsg = await prisma.chatMessage.create({ data: { role: "user", content: message, threadId: thread.id } });
      const botMsg = await prisma.chatMessage.create({ data: { role: "assistant", content: reply, threadId: thread.id } });
      thread = await prisma.chatThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
      return c.json({ user: userMsg, assistant: botMsg, crisis, thread }, 200);
    },
  );

  return app;
}

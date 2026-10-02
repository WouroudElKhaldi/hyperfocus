import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import type { StudySession } from "@hyperfocus/db";
import { CreateWinInput, Win, WinItem, WinsSummary } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, Ok, body, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { activeMs, type Db, httpError } from "../../types.ts";

// Wins (P2-14): the ones she writes down plus everything she finished, as one timeline, and AI talking points from them.
// Same answers as the Express routes had, plus the P2 fix: deleting a win that doesn't exist is a 404 (it was a 500).

const WIN_404 = "Win not found.";

/** Her own wins plus everything she finished in the last 180 days, newest first. */
export async function allWins(prisma: Db): Promise<WinItem[]> {
  const since = new Date(Date.now() - 180 * 86400000);
  const [manual, tasks, posts, sessions] = await Promise.all([
    prisma.win.findMany({ where: { createdAt: { gte: since } } }),
    prisma.task.findMany({ where: { doneAt: { gte: since } } }),
    prisma.post.findMany({ where: { postedAt: { gte: since } } }),
    prisma.studySession.findMany({ where: { endedAt: { gte: since } } }),
  ]);
  const minutes = (s: StudySession) => Math.round(activeMs(s) / 60000);
  const iso = (d: Date | null) => (d ? d.toISOString() : ""); // never empty here: each query asks for the date
  const list: WinItem[] = [
    ...manual.map((w) => ({ id: `win-${w.id}`, kind: "win" as const, text: w.text, date: w.createdAt.toISOString(), manual: true, winId: w.id })),
    ...tasks.map((t) => ({ id: `task-${t.id}`, kind: "task" as const, text: `Finished: ${t.title}`, date: iso(t.doneAt) })),
    ...posts.map((p) => ({ id: `post-${p.id}`, kind: "post" as const, text: `Published a LinkedIn post: "${((p.draft || p.thought).split("\n").find((l) => l.trim()) ?? "").slice(0, 90)}"`, date: iso(p.postedAt) })),
    ...sessions.filter((s) => minutes(s) >= 5).map((s) => ({ id: `study-${s.id}`, kind: "study" as const, text: `Studied ${minutes(s)} min${s.course ? `: ${s.course}` : ""}${s.part ? ` / ${s.part}` : ""}`, date: iso(s.endedAt) })),
  ];
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export function winsRouter({ prisma, events, ai }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const tags = ["Wins"];
  app.openapi(
    createRoute({ method: "get", path: "/api/wins", tags, summary: "The wins timeline: hers plus everything finished (180 days), newest first", responses: { 200: json(z.array(WinItem), "The timeline") } }),
    async (c) => c.json(await allWins(prisma), 200),
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/wins", tags, summary: "Write down a win", request: { body: body(CreateWinInput) }, responses: { 200: json(Win, "The win"), 400: problem("Nothing written") } }),
    async (c) => {
      const w = await prisma.win.create({ data: { text: c.req.valid("json").text } });
      await events.publish("WinLogged", { winId: w.id, text: w.text });
      return c.json(w, 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/wins/{id}", tags, summary: "Delete a win she wrote", request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: problem("No such win") } }),
    async (c) => {
      const { count } = await prisma.win.deleteMany({ where: { id: pathId(c.req.param("id"), WIN_404) } });
      if (!count) throw httpError(404, WIN_404);
      return c.json({ ok: true as const }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/wins/summary", tags, summary: "AI: honest talking points from her wins (reviews, promotions, CV)",
      responses: { 200: json(WinsSummary, "Bullets and a paragraph"), 400: problem("Fewer than 3 wins") },
    }),
    async (c) => {
      const wins = (await allWins(prisma)).slice(0, 150);
      if (wins.length < 3) throw httpError(400, "Log a few more wins first. There isn't enough here to summarise yet.");
      return c.json(await ai.run(prompts.winsSummary, { wins }), 200);
    },
  );
  return app;
}

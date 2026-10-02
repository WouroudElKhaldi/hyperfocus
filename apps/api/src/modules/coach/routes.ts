import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import { StuckHelp, StuckInput } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";

// Getting started (P2-18): the "I'm stuck" button, breaking a task into tiny steps, and sorting a brain dump. Same answers
// as the Express routes had.

const StepsInput = z.object({ task: z.string().optional() });
const OrganizeInput = z.object({ text: z.string().optional() });
const Steps = z.object({ steps: z.array(z.string()) });
const Items = z.object({ items: z.array(z.object({ kind: z.string(), title: z.string(), body: z.string() })) });

export function coachRouter({ prisma, ai }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({
      method: "post", path: "/api/stuck", tags: ["Coach"], summary: "AI: one tiny first step when she's stuck (uses her open tasks)",
      request: { body: body(StuckInput) }, responses: { 200: json(StuckHelp, "A kind sentence, a first step and a smaller fallback") },
    }),
    async (c) => {
      const { energy, blocker } = c.req.valid("json");
      const [tasks, running] = await Promise.all([
        prisma.task.findMany({ where: { done: false }, orderBy: { createdAt: "desc" }, take: 12 }),
        prisma.studySession.findFirst({ where: { endedAt: null } }),
      ]);
      return c.json(await ai.run(prompts.stuckHelp, {
        energy, blocker,
        todayTasks: tasks.filter((t) => t.today).map((t) => t.title),
        openTasks: tasks.filter((t) => !t.today).map((t) => t.title),
        studying: !!running,
      }), 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/ai/steps", tags: ["AI"], summary: "AI: break a task into 3-6 tiny steps", request: { body: body(StepsInput) }, responses: { 200: json(Steps, "The steps") } }),
    async (c) => c.json({ steps: await ai.run(prompts.taskSteps, { task: c.req.valid("json").task ?? "" }) }, 200),
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/ai/organize", tags: ["AI"], summary: "AI: sort a brain dump into tasks, ideas and notes", request: { body: body(OrganizeInput) }, responses: { 200: json(Items, "The items") } }),
    async (c) => c.json({ items: await ai.run(prompts.organize, { text: c.req.valid("json").text ?? "" }) }, 200),
  );
  return app;
}

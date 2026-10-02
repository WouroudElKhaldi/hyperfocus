import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { AiGateway } from "@hyperfocus/ai";
import type { ApiConfig } from "@hyperfocus/shared/config";
import { requestId } from "hono/request-id";
import type { Logger } from "pino";
import { problemResponse } from "./http/problem.ts";
import { defaultHook } from "./http/validation.ts";
import { backupsRouter } from "./modules/backups/routes.ts";
import { booksRouter } from "./modules/books/routes.ts";
import { calendarRouter } from "./modules/calendar/routes.ts";
import { goalsRouter } from "./modules/goals/routes.ts";
import { notesRouter } from "./modules/notes/routes.ts";
import { petRouter } from "./modules/pet/routes.ts";
import { profileRouter } from "./modules/profile/routes.ts";
import { remindersRouter } from "./modules/reminders/routes.ts";
import { settingsRouter } from "./modules/settings/routes.ts";
import { skillsRouter } from "./modules/skills/routes.ts";
import { studyRouter } from "./modules/study/routes.ts";
import { tasksRouter } from "./modules/tasks/routes.ts";
import type { EventBus } from "./events.ts";
import { type Db, httpError } from "./types.ts";

// The composition root (P2-01). Everything a route needs comes in through `deps`, so tests can pass fakes and nothing
// reaches for globals. Routes move here from Express one module at a time (P2-06 … P2-21); until then Express answers
// everything this app doesn't have a route for (see http/strangler.ts).
//
// Routes are declared with createRoute() and Zod schemas (P2-02): the same schema checks the request, types the
// handler and documents the route. The documentation is served at /api/docs (and the raw spec at /api/openapi.json).

export type AppDeps = { config: ApiConfig; prisma: Db; log: Logger; events: EventBus; ai: AiGateway };
/** What every request carries: its id (also sent back as X-Request-Id) and a logger that includes that id. */
export type AppEnv = { Variables: { requestId: string; log: Logger } };

const Health = z
  .object({
    ok: z.boolean().openapi({ description: "Always true when the API answers" }),
    ai: z.boolean().openapi({ description: "A DeepSeek key is set" }),
    n8n: z.boolean().openapi({ description: "LinkedIn posting through n8n is set up" }),
    demo: z.boolean().openapi({ description: "Running as the demo (no AI, posting, email or backups)" }),
  })
  .openapi("Health");

// In the demo nothing can reach your real backups, pop up notifications on this computer, or send email.
const DEMO_OFF = ["/api/backups", "/api/notify", "/api/emails", "/api/email-templates"];
const switchedOffInDemo = (path: string) => DEMO_OFF.some((p) => path === p || path.startsWith(`${p}/`));

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  tags: ["System"],
  summary: "Is the API up, and which outside services are connected",
  responses: { 200: { description: "The API is up", content: { "application/json": { schema: Health } } } },
});

export function createApp(deps: AppDeps) {
  const { config, log } = deps;
  const app = new OpenAPIHono<AppEnv>({ defaultHook }); // a request that breaks a schema gets a 400 with its message

  // an id per request: taken from the caller's X-Request-Id when it sends one, otherwise made here
  app.use(requestId());
  // one structured log line per request, with its id
  app.use(async (c, next) => {
    const started = performance.now();
    const reqLog = log.child({ requestId: c.get("requestId") });
    c.set("log", reqLog);
    await next();
    reqLog.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - started) }, "request");
  });
  app.onError((err, c) => problemResponse(c, err));
  if (config.demo) {
    app.use(async (c, next) => {
      if (switchedOffInDemo(c.req.path)) throw httpError(403, "This is switched off in the demo.");
      await next();
    });
  }

  app.openapi(healthRoute, (c) => c.json({ ok: true, ai: !!config.deepseek.apiKey, n8n: !!config.n8nWebhookUrl, demo: config.demo }, 200));

  // ---------- modules (moved from Express) ----------
  app.route("/", notesRouter(deps));
  app.route("/", tasksRouter(deps));
  app.route("/", remindersRouter(deps));
  app.route("/", goalsRouter(deps));
  app.route("/", studyRouter(deps));
  app.route("/", petRouter(deps));
  app.route("/", profileRouter(deps));
  app.route("/", settingsRouter());
  app.route("/", backupsRouter(deps));
  app.route("/", skillsRouter(deps));
  app.route("/", booksRouter(deps));
  app.route("/", calendarRouter(deps));

  // ---------- documentation ----------
  app.doc31("/api/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "Hyperfocus API",
      version: "0.1.0",
      description: "The routes served by the new Hono app. Routes not listed here are still answered by the older Express code (they move over during Phase 2).",
    },
  });
  app.get("/api/docs", Scalar({ url: "/api/openapi.json", pageTitle: "Hyperfocus API" }));

  return app;
}

export type App = ReturnType<typeof createApp>;

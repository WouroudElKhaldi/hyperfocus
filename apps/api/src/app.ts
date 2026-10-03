import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { AiGateway } from "@hyperfocus/ai";
import type { ApiConfig } from "@hyperfocus/shared/config";
import { requestId } from "hono/request-id";
import type { Logger } from "pino";
import { problemResponse } from "./http/problem.ts";
import { apiHeaders, bodyLimits, rateLimit } from "./http/security.ts";
import { defaultHook } from "./http/validation.ts";
import { backupsRouter } from "./modules/backups/routes.ts";
import { booksRouter } from "./modules/books/routes.ts";
import { calendarRouter } from "./modules/calendar/routes.ts";
import { chatRouter } from "./modules/chat/routes.ts";
import { coachRouter } from "./modules/coach/routes.ts";
import type { MailProvider } from "./modules/emails/mail-provider.ts";
import type { FileStorage } from "./storage/files.ts";
import type { Auth } from "./auth.ts";
import { OWNER_ID } from "./owner.ts";
import { asUser } from "./tenancy.ts";

/** What anyone may reach without signing in (cloud mode): health, signing in itself, and the API docs. */
const OPEN = /^\/api\/(health$|auth\/|docs\/?$|openapi\.json$)/;
import { emailsRouter } from "./modules/emails/routes.ts";
import { dataRouter } from "./modules/data/routes.ts";
import { goalsRouter } from "./modules/goals/routes.ts";
import { jobsRouter } from "./modules/jobs/routes.ts";
import { notesRouter } from "./modules/notes/routes.ts";
import { petRouter } from "./modules/pet/routes.ts";
import type { SocialPublisher } from "./modules/posts/publisher.ts";
import { postsRouter } from "./modules/posts/routes.ts";
import { profileRouter } from "./modules/profile/routes.ts";
import { remindersRouter } from "./modules/reminders/routes.ts";
import { reviewsRouter } from "./modules/reviews/routes.ts";
import { settingsRouter } from "./modules/settings/routes.ts";
import { skillsRouter } from "./modules/skills/routes.ts";
import { studyRouter } from "./modules/study/routes.ts";
import { tasksRouter } from "./modules/tasks/routes.ts";
import { winsRouter } from "./modules/wins/routes.ts";
import type { EventBus } from "./events.ts";
import { type Db, httpError } from "./types.ts";

// The composition root (P2-01). Everything a route needs comes in through `deps`, so tests can pass fakes and nothing
// reaches for globals. Every API route lives here (Express is gone since P2-22); src/server.ts puts CORS and, in the demo,
// the website in front of it.
//
// Routes are declared with createRoute() and Zod schemas (P2-02): the same schema checks the request, types the
// handler and documents the route. The documentation is served at /api/docs (and the raw spec at /api/openapi.json).

export type AppDeps = {
  config: ApiConfig; prisma: Db; log: Logger; events: EventBus; ai: AiGateway; publisher: SocialPublisher; mail: MailProvider;
  /** Where uploaded files go (P4-07); left out or null = inside the database. */
  files?: FileStorage | null;
  /** Accounts and sign-in (P5-01): only in cloud mode; left out = local mode (nobody signs in). */
  auth?: Auth | null;
};
/** What every request carries: its id (also sent back as X-Request-Id) and a logger that includes that id. */
export type AppEnv = { Variables: { requestId: string; log: Logger; /** who is asking (P5-03) */ userId: string } };

const Health = z
  .object({
    ok: z.boolean().openapi({ description: "Always true when the API answers" }),
    ai: z.boolean().openapi({ description: "A DeepSeek key is set" }),
    n8n: z.boolean().openapi({ description: "LinkedIn posting through n8n is set up" }),
    demo: z.boolean().openapi({ description: "Running as the demo (no AI, posting, email or backups)" }),
  })
  .openapi("Health");

// In the demo nothing can reach your real backups, pop up notifications on this computer, or send email.
const DEMO_OFF = ["/api/backups", "/api/notify", "/api/emails", "/api/email-templates", "/api/export", "/api/import"];
const switchedOffInDemo = (path: string) => DEMO_OFF.some((p) => path === p || path.startsWith(`${p}/`));

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  tags: ["System"],
  summary: "Is the API up, and which outside services are connected",
  responses: { 200: { description: "The API is up", content: { "application/json": { schema: Health } } } },
});

/** The OpenAPI document's header. Also used to generate the website's API types (scripts/api-types.mjs, P3-03). */
export const OPENAPI_DOC = {
  openapi: "3.1.0",
  info: {
    title: "Hyperfocus API",
    version: "0.1.0",
    description: "Every route of the Hyperfocus API. Errors are problem+json (RFC 9457) with the message in `error` too.",
  },
};

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
  // P2-23: data-only headers on every answer, requests per minute per visitor (fewer for the AI), and body size limits
  app.use(apiHeaders);
  app.use(rateLimit(config.rateLimit));
  app.use(bodyLimits());
  // P5-03: who is asking. Local mode: always the owner (nobody signs in). Cloud mode: the signed-in session, or 401.
  // The rest of the request runs as that person: the tenancy guard scopes every query to their rows.
  app.use("/api/*", async (c, next) => {
    if (OPEN.test(c.req.path)) return next();
    const userId = deps.auth ? ((await deps.auth.api.getSession({ headers: c.req.raw.headers }))?.user.id ?? null) : OWNER_ID;
    if (!userId) throw httpError(401, "Please sign in.");
    c.set("userId", userId);
    return asUser(userId, () => next());
  });
  if (config.demo) {
    app.use(async (c, next) => {
      if (switchedOffInDemo(c.req.path)) throw httpError(403, "This is switched off in the demo.");
      await next();
    });
  }

  // accounts and sign-in (P5-01, Better Auth): sign up, sign in and out, verify, reset, sessions, Google
  const auth = deps.auth;
  if (auth) app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.openapi(healthRoute, (c) => c.json({ ok: true, ai: !!config.deepseek.apiKey, n8n: !!config.n8nWebhookUrl, demo: config.demo }, 200));

  // ---------- modules ----------
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
  app.route("/", winsRouter(deps));
  app.route("/", reviewsRouter(deps));
  app.route("/", postsRouter(deps));
  app.route("/", chatRouter(deps));
  app.route("/", coachRouter(deps));
  app.route("/", emailsRouter(deps));
  app.route("/", dataRouter(deps)); // P4-08: export my data, and bring an export back
  app.route("/", jobsRouter(deps));

  // ---------- documentation ----------
  app.doc31("/api/openapi.json", OPENAPI_DOC);
  app.get("/api/docs", Scalar({ url: "/api/openapi.json", pageTitle: "Hyperfocus API" }));

  return app;
}

export type App = ReturnType<typeof createApp>;

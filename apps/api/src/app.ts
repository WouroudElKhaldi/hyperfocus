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
// (the ingest endpoint is signed instead of signed-in: P6-11)
const OPEN = /^\/api\/(health$|me$|auth\/|docs\/?$|openapi\.json$|ingest\/jobs$)/;
import { emailsRouter } from "./modules/emails/routes.ts";
import { dataRouter } from "./modules/data/routes.ts";
import { goalsRouter } from "./modules/goals/routes.ts";
import { jobsRouter } from "./modules/jobs/routes.ts";
import { adminRouter } from "./modules/admin/routes.ts";
import { notificationsRouter } from "./modules/notifications/routes.ts";
import { pushRouter } from "./modules/notifications/push-routes.ts";
import { accountRouter } from "./modules/account/routes.ts";
import { taxonomyRouter } from "./modules/taxonomy/routes.ts";
import { presetsRouter } from "./modules/taxonomy/presets-routes.ts";
import { radarFiltersRouter } from "./modules/radar/filters-routes.ts";
import { ingestRouter } from "./modules/radar/ingest-routes.ts";
import { radarMatchesRouter } from "./modules/radar/matches-routes.ts";
import { sourcesAdminRouter } from "./modules/radar/sources-admin-routes.ts";
import type { Vapid } from "./push.ts";
import type { Channel } from "./notifications.ts";
import { integrationsRouter } from "./modules/integrations/routes.ts";
import type { KeyRing } from "./secrets.ts";
import { type AppAi, withCredentials } from "./credentials.ts";
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
  /** The key ring that seals people's tokens (P5-07); left out = the integrations routes can list and disconnect only. */
  secrets?: KeyRing | null;
  /** Is the AI usable for the person asking (P5-07); left out = when the app has a DeepSeek key. */
  aiReady?: () => boolean;
  /** Web push keys (P5-11); left out = push is off. */
  vapid?: Vapid | null;
  /** The push channel built from those keys (P5-11). */
  push?: Channel | null;
  /** Accounts and sign-in (P5-01): only in cloud mode; left out = local mode (nobody signs in). */
  auth?: Auth | null;
};
/** What every request carries: its id (also sent back as X-Request-Id) and a logger that includes that id. */
export type AppEnv = { Variables: { requestId: string; log: Logger; /** who is asking (P5-03) */ userId: string; /** their role (P5-06) */ role: "user" | "admin" } };

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

// P5-04: how this copy runs and who is signed in, so the website knows whether to show the sign-in pages
const Me = z
  .object({
    mode: z.enum(["local", "cloud"]).openapi({ description: "local: just the owner, nobody signs in. cloud: people sign in." }),
    user: z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.enum(["user", "admin"]) }).nullable().openapi({ description: "Who is signed in (in local mode, the owner); null = nobody" }),
    flags: z.array(z.string()).openapi({ description: "The features an admin switched on (P5-06)" }),
    connected: z.object({ ai: z.boolean(), linkedin: z.boolean(), email: z.boolean() }).openapi({ description: "What works for you: your own credentials, or the app's where it shares them" }),
    google: z.boolean().openapi({ description: "Sign in with Google is offered" }),
  })
  .openapi("Me");
const meRoute = createRoute({
  method: "get", path: "/api/me", tags: ["System"], summary: "How this copy runs and who is signed in",
  responses: { 200: { description: "The mode and the signed-in person", content: { "application/json": { schema: Me } } } },
});

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

type Who = { id: string; name: string; email: string; role: "user" | "admin" };
/** Who may use the app's own DeepSeek key: the owner (local mode, or an ADMIN_EMAILS address); everyone only if shared. */
const appAiFor = ({ auth, config }: AppDeps, email: string): AppAi =>
  !auth || config.adminEmails.includes(email.toLowerCase()) ? "owner" : config.shareAiKey ? "shared" : "none";
/** Who is asking: the owner in local mode (an admin), otherwise the signed-in person or null. Admin = their role, or
 * their email in ADMIN_EMAILS. */
async function whoIsAsking({ auth, prisma, config }: AppDeps, headers: Headers): Promise<Who | null> {
  if (!auth) {
    const owner = await prisma.user.findUnique({ where: { id: OWNER_ID }, select: { id: true, name: true, email: true } });
    return { ...(owner ?? { id: OWNER_ID, name: "You", email: "" }), role: "admin" };
  }
  const s = await auth.api.getSession({ headers });
  if (!s) return null;
  const admin = s.user.role === "admin" || config.adminEmails.includes(s.user.email.toLowerCase());
  return { id: s.user.id, name: s.user.name, email: s.user.email, role: admin ? "admin" : "user" };
}

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
    // (local mode: the owner, an admin, without asking the database)
    const who = deps.auth ? await whoIsAsking(deps, c.req.raw.headers) : { id: OWNER_ID, role: "admin" as const, email: "" };
    if (!who) throw httpError(401, "Please sign in.");
    const userId = who.id;
    c.set("userId", userId);
    c.set("role", who.role);
    // with their own credentials opened (P5-07): their AI key, n8n webhook, Gmail
    return asUser(userId, () => withCredentials(deps.prisma, deps.secrets, () => next(), appAiFor(deps, who.email)));
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

  app.openapi(meRoute, async (c) => {
    const flags = (await deps.prisma.featureFlag.findMany({ where: { enabled: true }, select: { key: true }, orderBy: { key: "asc" } })).map((f) => f.key);
    const who = await whoIsAsking(deps, c.req.raw.headers);
    const user = who ? { id: who.id, name: who.name, email: who.email, role: who.role } : null;
    const aiReady = deps.aiReady ?? (() => !!config.deepseek.apiKey);
    const connected = !who ? { ai: false, linkedin: false, email: false }
      : await asUser(who.id, () => withCredentials(deps.prisma, deps.secrets, async () => ({ ai: aiReady(), linkedin: deps.publisher.configured(), email: !deps.mail.unavailable() }), appAiFor(deps, who.email)));
    return c.json({ mode: deps.auth ? ("cloud" as const) : ("local" as const), user, flags, connected, google: !!deps.auth && !!config.auth.google }, 200);
  });

  app.openapi(healthRoute, (c) => c.json({ ok: true, ai: !!config.deepseek.apiKey, n8n: !!config.n8nWebhookUrl, demo: config.demo }, 200));

  // ---------- modules ----------
  app.route("/", notesRouter(deps));
  app.route("/", tasksRouter(deps));
  app.route("/", remindersRouter(deps));
  app.route("/", goalsRouter(deps));
  app.route("/", studyRouter(deps));
  app.route("/", petRouter(deps));
  app.route("/", profileRouter(deps));
  app.route("/", settingsRouter(deps));
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
  app.route("/", adminRouter(deps)); // P5-06: admins only
  app.route("/", notificationsRouter(deps)); // P5-11: the bell
  app.route("/", pushRouter(deps)); // P5-11: web push on your devices
  app.route("/", accountRouter(deps)); // P5-12: delete my account
  app.route("/", taxonomyRouter(deps)); // P6-06: typeahead over jobs, skills, majors, places
  app.route("/", presetsRouter(deps)); // P6-07: "I study ___" presets
  app.route("/", radarFiltersRouter(deps)); // P6-20: your Job Radar filters
  app.route("/", ingestRouter(deps)); // P6-11: signed batches of postings
  app.route("/", radarMatchesRouter(deps)); // P6-25/26/27: your matches
  app.route("/", sourcesAdminRouter(deps)); // P6-18: job sources (admins only)
  app.route("/", integrationsRouter(deps)); // P5-07: your connected accounts (never their tokens)

  // ---------- documentation ----------
  app.doc31("/api/openapi.json", OPENAPI_DOC);
  app.get("/api/docs", Scalar({ url: "/api/openapi.json", pageTitle: "Hyperfocus API" }));

  return app;
}

export type App = ReturnType<typeof createApp>;

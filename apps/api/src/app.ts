import type { ApiConfig } from "@hyperfocus/shared/config";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import type { Logger } from "pino";
import { problemResponse } from "./http/problem.ts";
import type { Db } from "./types.ts";

// The composition root (P2-01). Everything a route needs comes in through `deps`, so tests can pass fakes and nothing
// reaches for globals. Routes move here from Express one module at a time (P2-06 … P2-21); until then Express answers
// everything this app doesn't have a route for (see http/strangler.ts).

export type AppDeps = { config: ApiConfig; prisma: Db; log: Logger };
/** What every request carries: its id (also sent back as X-Request-Id) and a logger that includes that id. */
export type AppEnv = { Variables: { requestId: string; log: Logger } };

export function createApp(deps: AppDeps) {
  const { config, log } = deps;
  const app = new Hono<AppEnv>();

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

  app.get("/api/health", (c) => c.json({ ok: true, ai: !!config.deepseek.apiKey, n8n: !!config.n8nWebhookUrl, demo: config.demo }));

  return app;
}

export type App = ReturnType<typeof createApp>;

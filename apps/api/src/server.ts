import fs from "node:fs";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { SECURITY_HEADERS } from "../../web/security-headers.mjs";
import type { App } from "./app.ts";
import { problemResponse } from "./http/problem.ts";
import { httpError } from "./types.ts";

// The whole HTTP server (P2-22: Express is gone). In front of the API: CORS (from the config, P2-23). In the demo it
// also serves the built website from the same port (so only ONE port is ever shared), with the browser security headers
// and the single-page-app fallback (any non-API address gets index.html).

/** Pages on this computer may call the API from another port (like the website's dev server). */
export const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

/** Which pages may call the API from another address: the CORS_ORIGINS list, or (empty) pages on this computer. */
export const allowedOrigin = (list: string[]) => (origin: string) => ((list.length ? list.includes(origin) : LOCAL_ORIGIN.test(origin)) ? origin : null);

export function createServer(api: App, { demo = false, webDist = "", corsOrigins = [] }: { demo?: boolean; webDist?: string; corsOrigins?: string[] } = {}) {
  const server = new Hono();
  server.use("/api/*", cors({ origin: allowedOrigin(corsOrigins) }));
  server.route("/", api);
  // an address the API doesn't have: a problem like every other API error (Express answered with an HTML page)
  server.notFound((c) =>
    c.req.path.startsWith("/api/")
      ? problemResponse(c as never, httpError(404, `There is no ${c.req.method} ${c.req.path} in the API.`))
      : c.text("Not found", 404),
  );

  if (demo && webDist) {
    server.use("*", async (c, next) => {
      await next();
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
    });
    server.use("*", serveStatic({ root: webDist }));
    const indexHtml = path.join(webDist, "index.html");
    server.get("*", (c) => (c.req.path.startsWith("/api/") || !fs.existsSync(indexHtml) ? c.notFound() : c.html(fs.readFileSync(indexHtml, "utf8"))));
  }
  return server;
}

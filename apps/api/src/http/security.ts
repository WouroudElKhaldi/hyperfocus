import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../app.ts";
import { httpError } from "../types.ts";
import { problemResponse } from "./problem.ts";

// Request limits and headers for every API response (P2-23).

// ---------- rate limits ----------
/** The routes that call the AI. Each call costs credits, so they get their own, smaller limit. */
const AI_ROUTE = /^\/api\/(ai\/[\w-]+|chat|stuck|skills\/suggest|skills\/\d+\/plan|books\/\d+\/(ask|find)|goals\/\d+\/analyze|calendar\/(parse|plan)|wins\/summary|reviews)$/;
export const isAiRequest = (method: string, path: string) => method === "POST" && AI_ROUTE.test(path);

/** Who is asking: the address of the connection (behind a proxy, P7 reads it from the proxy instead). */
const clientOf = (c: Context) => (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress ?? "local";

/**
 * A fixed one-minute window per visitor, kept in memory. Fine for one API process; with several (P7) the counts move
 * to the database or Redis behind the same middleware.
 */
export function rateLimit({ perMinute, aiPerMinute, now = Date.now }: { perMinute: number; aiPerMinute: number; now?: () => number }): MiddlewareHandler<AppEnv> {
  const windows = new Map<string, { start: number; count: number }>();
  const WINDOW = 60_000;
  const hit = (key: string, limit: number) => {
    const t = now();
    let w = windows.get(key);
    if (!w || t - w.start >= WINDOW) {
      if (windows.size > 10_000) for (const [k, v] of windows) if (t - v.start >= WINDOW) windows.delete(k); // forget old visitors
      w = { start: t, count: 0 };
      windows.set(key, w);
    }
    w.count++;
    return w.count > limit ? Math.ceil((w.start + WINDOW - t) / 1000) : 0;
  };
  return async (c, next) => {
    const who = clientOf(c);
    const ai = isAiRequest(c.req.method, c.req.path);
    const wait = hit(`all:${who}`, perMinute) || (ai ? hit(`ai:${who}`, aiPerMinute) : 0);
    if (wait) {
      const res = problemResponse(c, httpError(429, ai ? "That's a lot of AI requests in one minute. Take a breath and try again in a moment." : "Too many requests in one minute. Try again in a moment."));
      res.headers.set("Retry-After", String(wait));
      return res;
    }
    await next();
  };
}

// ---------- body size ----------
export const JSON_LIMIT = 1024 * 1024; // the same 1 MB Express had
export const UPLOAD_LIMIT = 20 * 1024 * 1024 + 64 * 1024; // a 20 MB file (the email module checks it exactly)
const UPLOAD_ROUTE = /^\/api\/(emails|email-templates)\/\d+\/attachments$/;

/** 1 MB for every request body, except file uploads to an email or template (20 MB). */
export function bodyLimits(): MiddlewareHandler<AppEnv> {
  const tooBig = (what: string) => (c: Context<AppEnv>) => problemResponse(c, httpError(413, `That request is too large (the limit is ${what}).`));
  const json = bodyLimit({ maxSize: JSON_LIMIT, onError: tooBig("1 MB") });
  const upload = bodyLimit({ maxSize: UPLOAD_LIMIT, onError: tooBig("20 MB per file") });
  // an export brought back (P4-08) holds every file too
  const restore = bodyLimit({ maxSize: 500 * 1024 * 1024, onError: tooBig("500 MB") });
  return (c, next) => (c.req.path === "/api/import" ? restore : UPLOAD_ROUTE.test(c.req.path) ? upload : json)(c, next);
}

// ---------- headers ----------
/** API answers are data, never pages: no sniffing, no framing, no referrer, not cached by the browser. */
export const API_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};
/** The docs page loads its viewer from a CDN, so it keeps its own headers apart from these. */
const DOCS = /^\/api\/docs\/?$/;

export const apiHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (DOCS.test(c.req.path)) return;
  for (const [k, v] of Object.entries(API_HEADERS)) if (!c.res.headers.has(k)) c.res.headers.set(k, v);
};

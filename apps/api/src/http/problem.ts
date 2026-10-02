import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../app.ts";
import { errorInfo } from "../types.ts";

// Errors as "problem details" (RFC 9457): { type, title, status, detail }, sent as application/problem+json.
// `error` repeats the detail because that is the field the website (api.ts) and the contract tests read today.

const TITLES: Record<number, string> = {
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 409: "Conflict", 413: "Content Too Large",
  422: "Unprocessable Content", 429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
};

export type Problem = { type: string; title: string; status: number; detail: string; error: string; requestId?: string };

/** Turns anything thrown into a problem response. An HttpError keeps its status; anything else is a 500. */
export function problemResponse(c: Context<AppEnv>, thrown: unknown): Response {
  const e = errorInfo(thrown);
  const status = e.status && e.status >= 400 && e.status <= 599 ? e.status : 500;
  // (both are set by the first middlewares, but an error can happen before they run)
  const requestId: string | undefined = c.get("requestId");
  const log = c.get("log") as AppEnv["Variables"]["log"] | undefined;
  if (status >= 500) log?.error({ err: thrown, requestId }, e.message);
  const body: Problem = { type: "about:blank", title: TITLES[status] ?? "Error", status, detail: e.message, error: e.message, ...(requestId ? { requestId } : {}) };
  return c.body(JSON.stringify(body), status as ContentfulStatusCode, { "Content-Type": "application/problem+json" });
}

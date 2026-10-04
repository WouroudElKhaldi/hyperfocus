import { NOTE_KINDS, type NoteKind } from "@hyperfocus/shared/constants";
import i18next from "i18next";
import type { ApiUrl, BodyOf, Method, NeedsBody, ResponseOf } from "./api/typed.ts";

/** An error from the API: `status` is the HTTP status, `code` the raw error text (some callers branch on it). */
export type ApiError = Error & { status?: number; code?: string };

/** Reads `.message` and `.status` from anything thrown, without assuming it is an Error. */
export const errorOf = (e: unknown): ApiError => (e instanceof Error ? e : new Error(String(e)));

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : null,
    });
  } catch {
    throw new Error("Can't reach the server. Is `pnpm dev` running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e: ApiError = new Error(data.error || `Request failed (${res.status})`);
    e.code = data.error;
    e.status = res.status;
    // cloud mode, signed out (or the session ended): the app shows the sign-in page (P5-04)
    if (res.status === 401) window.dispatchEvent(new Event("signed-out"));
    throw e;
  }
  // anything that changed data may have earned your pet some XP, so tell the pet widget to look again
  if (method !== "GET") window.dispatchEvent(new Event("data-changed"));
  return data as T;
}

// The API, typed from its own description (P3-03, see api/typed.ts), written without "/api": api.get(`/tasks/${id}`).
// The address is checked against the real routes (a typo or the wrong method doesn't compile), the body against what the
// route accepts, and the answer has the route's response type.
type Body<M extends Method, U extends string> = NeedsBody<M, U> extends true ? [body: BodyOf<M, U>] : [body?: BodyOf<M, U>];
export const api = {
  get: <const U extends string>(u: U & ApiUrl<"get", U>) => req<ResponseOf<"get", U>>("GET", u),
  post: <const U extends string>(u: U & ApiUrl<"post", U>, ...[b]: Body<"post", U>) => req<ResponseOf<"post", U>>("POST", u, b ?? {}),
  put: <const U extends string>(u: U & ApiUrl<"put", U>, ...[b]: Body<"put", U>) => req<ResponseOf<"put", U>>("PUT", u, b ?? {}),
  patch: <const U extends string>(u: U & ApiUrl<"patch", U>, ...[b]: Body<"patch", U>) => req<ResponseOf<"patch", U>>("PATCH", u, b),
  del: <const U extends string>(u: U & ApiUrl<"delete", U>) => req<ResponseOf<"delete", U>>("DELETE", u),
};

// The kinds come from @hyperfocus/shared (the same list the API uses); their labels are in the language files (P3-28),
// read each time, so they follow the chosen language.
export const KINDS: Record<string, string> = {};
for (const k of NOTE_KINDS) Object.defineProperty(KINDS, k, { enumerable: true, get: () => i18next.t(`kinds.${k as NoteKind}`) });

// Study time excludes breaks. A running session counts up to now, or to the moment it was paused.
type Timed = { startedAt: string; endedAt: string | null; pausedAt: string | null; breakMs?: number };
const studyEnd = (s: Timed, now: number) => (s.endedAt ? new Date(s.endedAt).getTime() : s.pausedAt ? new Date(s.pausedAt).getTime() : now);
export const studySecs = (s: Timed, now = Date.now()) =>
  Math.max(0, Math.floor((studyEnd(s, now) - new Date(s.startedAt).getTime() - (s.breakMs || 0)) / 1000));
export const studyMins = (s: Timed, now = Date.now()) => Math.round(studySecs(s, now) / 60);

/** A value from a <select> (plain text) as one of the allowed values, or the fallback. */
export const oneOf = <const T extends readonly string[]>(allowed: T, value: string, fallback: T[number]): T[number] =>
  (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;

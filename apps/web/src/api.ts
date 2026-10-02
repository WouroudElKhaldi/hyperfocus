import { NOTE_KINDS, type NoteKind } from "@hyperfocus/shared/constants";

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
    throw new Error("Can't reach the server. Is `npm run dev` running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e: ApiError = new Error(data.error || `Request failed (${res.status})`);
    e.code = data.error;
    e.status = res.status;
    throw e;
  }
  // anything that changed data may have earned your pet some XP, so tell the pet widget to look again
  if (method !== "GET") window.dispatchEvent(new Event("data-changed"));
  return data as T;
}

// Each call names the type it gets back (see types.ts). TODO(types): P3-03 infers these from the typed Hono client.
export const api = {
  get: <T>(u: string) => req<T>("GET", u),
  post: <T = unknown>(u: string, b?: unknown) => req<T>("POST", u, b ?? {}),
  put: <T = unknown>(u: string, b?: unknown) => req<T>("PUT", u, b ?? {}),
  patch: <T = unknown>(u: string, b?: unknown) => req<T>("PATCH", u, b),
  del: <T = unknown>(u: string) => req<T>("DELETE", u),
};

// The kinds come from @hyperfocus/shared (the same list the API uses); only the labels live here.
const KIND_LABELS: Record<NoteKind, string> = {
  thought: "💭 Thought",
  note: "📝 Note",
  post_idea: "✨ Post idea",
  project_idea: "🚀 Project idea",
};
export const KINDS: Record<string, string> = Object.fromEntries(NOTE_KINDS.map((k) => [k, KIND_LABELS[k]]));

// Study time excludes breaks. A running session counts up to now, or to the moment it was paused.
type Timed = { startedAt: string; endedAt: string | null; pausedAt: string | null; breakMs?: number };
const studyEnd = (s: Timed, now: number) => (s.endedAt ? new Date(s.endedAt).getTime() : s.pausedAt ? new Date(s.pausedAt).getTime() : now);
export const studySecs = (s: Timed, now = Date.now()) =>
  Math.max(0, Math.floor((studyEnd(s, now) - new Date(s.startedAt).getTime() - (s.breakMs || 0)) / 1000));
export const studyMins = (s: Timed, now = Date.now()) => Math.round(studySecs(s, now) / 60);

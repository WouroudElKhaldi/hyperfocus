// The study timer as a small state machine (P2-10). Pure functions: they get a session's times and "now", and say what
// to change, so every rule can be tested without a database.
//
//   running ──pause──▶ paused ──resume──▶ running        (a resume adds the break to breakMs)
//   running / paused ──stop──▶ stopped                   (stopping during a break ends it when the break began)
//   stopped ──continue (within 6 hours)──▶ running       (the time away counts as a break)

export type SessionTimes = { startedAt: Date; endedAt: Date | null; pausedAt: Date | null; breakMs: number };
export type SessionState = "running" | "paused" | "stopped";
export type Change = Partial<Pick<SessionTimes, "endedAt" | "pausedAt" | "breakMs">>;

/** What to do: change these fields, do nothing (the session is already there), or refuse with a 409 and a message. */
export type Transition = { change: Change } | { nothing: true } | { refuse: string };

export const CONTINUE_WITHIN_MS = 6 * 3600 * 1000;
const NOT_RUNNING = "This session isn't running.";

export const stateOf = (s: SessionTimes): SessionState => (s.endedAt ? "stopped" : s.pausedAt ? "paused" : "running");

/** A break starts. */
export function pause(s: SessionTimes, now: Date): Transition {
  const state = stateOf(s);
  if (state === "stopped") return { refuse: NOT_RUNNING };
  if (state === "paused") return { nothing: true };
  return { change: { pausedAt: now } };
}

/** The break ends and is added to the session's break time. */
export function resume(s: SessionTimes, now: Date): Transition {
  const state = stateOf(s);
  if (state === "stopped") return { refuse: NOT_RUNNING };
  if (state === "running" || !s.pausedAt) return { nothing: true };
  return { change: { breakMs: s.breakMs + (now.getTime() - s.pausedAt.getTime()), pausedAt: null } };
}

/** The session ends. During a break it ends when the break began, so time away is never counted. */
export function stop(s: SessionTimes, now: Date): Transition {
  if (stateOf(s) === "stopped") return { nothing: true };
  return { change: { endedAt: s.pausedAt ?? now, pausedAt: null } };
}

/** Undo an accidental stop: the session runs again and the time since it stopped counts as a break. */
export function reopen(s: SessionTimes, now: Date, anotherIsRunning: boolean): Transition {
  if (!s.endedAt) return { nothing: true }; // already running
  if (anotherIsRunning) return { refuse: "Another session is running. Stop it first." };
  const gap = now.getTime() - s.endedAt.getTime();
  if (gap > CONTINUE_WITHIN_MS) return { refuse: "That session ended more than 6 hours ago. Start a new session for the same part instead." };
  return { change: { endedAt: null, pausedAt: null, breakMs: s.breakMs + gap } };
}

// ---------- logging a past session, or editing a saved one ----------

/** Checks a session typed in by hand. Returns the problem, or null when it is fine. */
export function checkLogged(startedAt: Date, endedAt: Date | null, breakMs: number): string | null {
  if (endedAt && endedAt <= startedAt) return "End time must be after the start time.";
  if (endedAt && breakMs >= endedAt.getTime() - startedAt.getTime()) return "The break can't be as long as the whole session.";
  return null;
}

/**
 * Checks an edit of a session against the session as it is. A saved session can be made longer but never shorter
 * (with a minute of slack, because the form only has minutes). Returns the problem, or null.
 */
export function checkEdit(cur: SessionTimes, edit: { startedAt?: Date; endedAt?: Date; breakMs?: number }): string | null {
  const s = edit.startedAt ?? cur.startedAt, e = edit.endedAt ?? cur.endedAt, breakMs = edit.breakMs ?? cur.breakMs;
  const problem = checkLogged(s, e, breakMs);
  if (problem) return problem;
  if (cur.endedAt && e) {
    const before = cur.endedAt.getTime() - cur.startedAt.getTime() - cur.breakMs;
    const after = e.getTime() - s.getTime() - breakMs;
    if (after < before - 60000) return "You can add time to a saved session but not remove it. If it was a mistake, delete the session instead.";
  }
  return null;
}

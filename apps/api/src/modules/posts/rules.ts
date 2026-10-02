// The rules for posting automatically (P2-15), as pure functions so they can be tested without a clock or a database.

/** LinkedIn's API can't create real tags, so a post that tags someone (@name) must be posted by hand. */
export const MENTION = /(^|\s)@[\p{L}\d_]/u;
export const MAX_LENGTH = 3000;
/** If the app was closed at the scheduled time, it still posts when reopened within 2 hours. */
export const CATCH_UP_MS = 2 * 3600 * 1000;
export const RETRY_GAP_MS = 2 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

/** Why a draft can't be posted automatically, or null when it can. */
export function autoPostProblem(draft: string): string | null {
  if (!draft.trim()) return "The draft is empty.";
  if (draft.length > MAX_LENGTH) return "The draft is over LinkedIn's 3000 character limit.";
  if (MENTION.test(draft)) return "Posts that tag someone (@name) can't be auto-posted, because the tag would come out as plain text. Post it by hand on LinkedIn.";
  return null;
}

type Due = { scheduledAt: Date | null; attempts: number; lastAttemptAt: Date | null };

/**
 * What the scheduler does with a scheduled post that is due:
 * "missed" when it was never tried and is too late to post now, "wait" while a failed attempt is too recent, else "send".
 */
export function dueAction(p: Due, now: Date): "missed" | "wait" | "send" {
  if (!p.attempts && now.getTime() - (p.scheduledAt?.getTime() ?? 0) > CATCH_UP_MS) return "missed";
  if (p.lastAttemptAt && now.getTime() - p.lastAttemptAt.getTime() < RETRY_GAP_MS) return "wait";
  return "send";
}

/** After a failed send: try again later, or give up. */
export const afterFailure = (attempts: number, retry: boolean) => (retry && attempts < MAX_ATTEMPTS ? "scheduled" : "failed");

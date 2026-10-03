import type { Db } from "../types.ts";

// Keeping postings only while they're fresh (P6-17, docs/job-sources.md): a posting past its date (the source's
// closing date, or 45 days after it was posted) is archived: its text and the raw item are deleted, only what is needed
// to show it in someone's saved or applied list stays (title, company, link). Archived postings nobody saved or applied
// to are deleted after 90 days.

const DAY = 24 * 3600_000;

export async function applyPostingRetention(db: Db, now = new Date()): Promise<{ archived: number; deleted: number }> {
  const archived = await db.jobPosting.updateMany({
    where: { archivedAt: null, expiresAt: { lt: now } },
    data: { archivedAt: now, description: "", raw: {} },
  });
  const old = new Date(now.getTime() - 90 * DAY);
  const deleted = await db.jobPosting.deleteMany({
    where: { archivedAt: { lt: old }, matches: { none: { status: { in: ["saved", "applied"] } } } },
  });
  return { archived: archived.count, deleted: deleted.count };
}

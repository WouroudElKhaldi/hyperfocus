// Job applications (P2-17): the rules. Which fields she may edit and how they are checked, and what sending an email for
// a job does to it. The routes are in ./routes.ts.
import { type Db, httpError as err, type UncheckedJson } from "../../types.ts";

export const JOB_STATUSES = ["wishlist", "applied", "interview", "offer", "rejected", "withdrawn"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const emailPick = { id: true, subject: true, toAddr: true, status: true, sentAt: true, updatedAt: true } as const;

const TEXT_FIELDS = ["company", "title", "url", "location", "salary", "source", "contactName", "contactEmail", "notes"] as const;
type JobFields = { [K in (typeof TEXT_FIELDS)[number]]?: string } & { status?: string; followUpDay?: string | null; appliedAt?: Date | null };

// Only the fields she may edit by hand. Anything not sent stays as it was.
// The fields are checked here rather than by a schema per field, because the first problem found is the one reported and
// "company" is required on create but only refused when emptied on change.
export function fields(b: UncheckedJson, partial: false): JobFields & { company: string };
export function fields(b: UncheckedJson, partial: true): JobFields;
export function fields(b: UncheckedJson, partial: boolean): JobFields {
  const out: JobFields = {};
  for (const k of TEXT_FIELDS) {
    if (b[k] !== undefined) out[k] = String(b[k]).trim().slice(0, k === "notes" ? 5000 : 300);
  }
  if (b.status !== undefined) {
    if (!JOB_STATUSES.includes(b.status)) throw err(400, "Unknown status.");
    out.status = b.status;
  }
  if (b.followUpDay !== undefined) {
    if (b.followUpDay && !DAY_RE.test(b.followUpDay)) throw err(400, "Follow-up day must look like 2026-10-31.");
    out.followUpDay = b.followUpDay || null;
  }
  if (b.appliedAt !== undefined) {
    const d = b.appliedAt ? new Date(b.appliedAt) : null;
    if (d && Number.isNaN(d.getTime())) throw err(400, "That applied date isn't valid.");
    out.appliedAt = d;
  }
  if (!partial && !out.company) throw err(400, "Which company is it?");
  if (partial && out.company === "") throw err(400, "Which company is it?");
  return out;
}

// called when an email is sent or linked, so a job with a sent email flips to "applied" by itself
export async function jobSent(prisma: Db, email: { jobId: number | null; sentAt: Date | null }): Promise<void> {
  if (!email.jobId) return;
  const job = await prisma.jobApplication.findUnique({ where: { id: email.jobId } });
  if (job && job.status === "wishlist") await prisma.jobApplication.update({ where: { id: job.id }, data: { status: "applied", appliedAt: email.sentAt || new Date() } });
}

import { z } from "zod";
import { Id, IsoDateTime } from "./primitives.ts";

// Job applications (P3-03: documented, so the website's generated types are exact).

/** wishlist | applied | interview | offer | rejected | withdrawn */
export const JOB_STATUSES = ["wishlist", "applied", "interview", "offer", "rejected", "withdrawn"] as const;

export const Job = z.object({
  id: Id, company: z.string(), title: z.string(), url: z.string(), location: z.string(), salary: z.string(), source: z.string(),
  status: z.string(), appliedAt: IsoDateTime.nullable(), followUpDay: z.string().nullable(), contactName: z.string(),
  contactEmail: z.string(), notes: z.string(), createdAt: IsoDateTime, updatedAt: IsoDateTime,
});
export type Job = z.infer<typeof Job>;
/** An email linked to a job, in short. */
export const JobEmail = z.object({ id: Id, subject: z.string(), toAddr: z.string(), status: z.string(), sentAt: IsoDateTime.nullable(), updatedAt: IsoDateTime });
export const JobListItem = Job.extend({ emailCount: z.number().int(), lastSentAt: IsoDateTime.nullable() });
export const JobDetail = Job.extend({ emails: z.array(JobEmail) });
/** PUT /api/emails/:id/job answers with the email in short, and its job. */
export const LinkedEmail = JobEmail.extend({ jobId: Id.nullable() });

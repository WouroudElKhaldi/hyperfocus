import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Email, Job, JobDetail, JobListItem, LinkedEmail } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, Ok, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError, orNull } from "../../types.ts";
import { JOB_STATUSES, emailPick, fields, jobSent } from "./rules.ts";

// Job applications (P2-17): the jobs she is eyeing or has applied for, and the emails she sent for each one. Same answers
// as the Express routes had, plus the P2 fix: deleting a job that doesn't exist is a 404 "Job not found." (it was a quiet
// { ok: true }), and a request body that isn't an object is a 400.

const JOB_404 = "Job not found.";
// the detailed checks (and their messages) are in rules.ts; the body is documented here
const JobFields = z
  .looseObject({
    company: z.string(), title: z.string(), url: z.string(), location: z.string(), salary: z.string(), source: z.string(),
    contactName: z.string(), contactEmail: z.string(), notes: z.string(),
    status: z.string().openapi({ description: `One of: ${JOB_STATUSES.join(", ")}` }),
    followUpDay: z.string().nullable().openapi({ example: "2026-10-31" }), appliedAt: z.string().nullable(),
  })
  .partial()
  .openapi("JobFields");
const LinkInput = z.object({ jobId: z.union([z.number(), z.string()]).nullable().optional() });

export function jobsRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const tags = ["Jobs"];
  const jobId = (raw: string | undefined) => pathId(raw, JOB_404);
  const bodyOf = <S extends z.ZodType>(schema: S) => ({ content: { "application/json": { schema } }, required: true as const });

  app.openapi(
    createRoute({ method: "get", path: "/api/jobs", tags, summary: "Every job, most recently changed first, with its email count", responses: { 200: json(z.array(JobListItem), "The jobs") } }),
    async (c) => {
      const rows = await prisma.jobApplication.findMany({ orderBy: { updatedAt: "desc" }, include: { emails: { select: { id: true, status: true, sentAt: true } } } });
      return c.json(rows.map(({ emails, ...j }) => ({ ...j, emailCount: emails.length, lastSentAt: emails.filter((e) => e.sentAt).map((e) => e.sentAt).sort().pop() || null })), 200);
    },
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/jobs", tags, summary: "Add a job (the company is required; starts on the wishlist)", request: { body: bodyOf(JobFields) }, responses: { 200: json(Job, "The job"), 400: problem("Something to fix") } }),
    async (c) => c.json(await prisma.jobApplication.create({ data: fields(c.req.valid("json"), false) }), 200),
  );
  app.openapi(
    createRoute({ method: "get", path: "/api/jobs/{id}", tags, summary: "One job with its emails", request: { params: IdParam }, responses: { 200: json(JobDetail, "The job"), 404: problem("No such job") } }),
    async (c) => {
      const j = await prisma.jobApplication.findUnique({ where: { id: jobId(c.req.param("id")) }, include: { emails: { select: emailPick, orderBy: { updatedAt: "desc" } } } });
      if (!j) throw httpError(404, JOB_404);
      return c.json(j, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/jobs/{id}", tags, summary: "Change a job (only the fields sent change)", request: { params: IdParam, body: bodyOf(JobFields) },
      responses: { 200: json(Job, "The job"), 400: problem("Something to fix"), 404: problem("No such job") },
    }),
    async (c) => {
      const data = fields(c.req.valid("json"), true);
      const cur = await prisma.jobApplication.findUnique({ where: { id: jobId(c.req.param("id")) } });
      if (!cur) throw httpError(404, JOB_404);
      // moving it off the wishlist for the first time stamps today, so the applied date is never empty
      if (data.status && data.status !== "wishlist" && !cur.appliedAt && data.appliedAt === undefined) data.appliedAt = new Date();
      return c.json(await prisma.jobApplication.update({ where: { id: cur.id }, data }), 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/jobs/{id}", tags, summary: "Delete a job (its emails stay, just unlinked)", request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: problem("No such job") } }),
    async (c) => {
      const { count } = await prisma.jobApplication.deleteMany({ where: { id: jobId(c.req.param("id")) } });
      if (!count) throw httpError(404, JOB_404);
      return c.json({ ok: true as const }, 200);
    },
  );

  // link an email to a job (jobId) or unlink it (jobId null). Works on sent emails too, which is the whole point.
  app.openapi(
    createRoute({
      method: "put", path: "/api/emails/{id}/job", tags, summary: "Link an email to a job, or unlink it (jobId null)", request: { params: IdParam, body: bodyOf(LinkInput) },
      responses: { 200: json(LinkedEmail, "The email, in short, with its job"), 404: problem("No such email or job") },
    }),
    async (c) => {
      const raw = c.req.valid("json").jobId;
      const linkTo = raw == null || raw === "" ? null : Number(raw);
      if (linkTo !== null && !(await prisma.jobApplication.findUnique({ where: { id: Number.isInteger(linkTo) ? linkTo : -1 } }))) throw httpError(404, JOB_404);
      const mail = await orNull(prisma.email.update({ where: { id: pathId(c.req.param("id"), "Email not found.") }, data: { jobId: linkTo }, select: emailPick }));
      if (!mail) throw httpError(404, "Email not found.");
      if (linkTo !== null && mail.status === "sent") await jobSent(prisma, { jobId: linkTo, sentAt: mail.sentAt });
      return c.json({ ...mail, jobId: linkTo }, 200);
    },
  );

  // start an application email for a job: a draft already linked, addressed and titled
  app.openapi(
    createRoute({ method: "post", path: "/api/jobs/{id}/email", tags, summary: "Start an application email for this job (linked, addressed, titled)", request: { params: IdParam }, responses: { 200: json(Email, "The draft"), 404: problem("No such job") } }),
    async (c) => {
      const j = await prisma.jobApplication.findUnique({ where: { id: jobId(c.req.param("id")) } });
      if (!j) throw httpError(404, JOB_404);
      const subject = `Application: ${j.title || "Open position"}${j.company ? ` at ${j.company}` : ""}`.slice(0, 300);
      // (with its empty file list, like every other route that answers with an email)
      return c.json({ ...(await prisma.email.create({ data: { jobId: j.id, toAddr: j.contactEmail, subject } })), attachments: [] }, 200);
    },
  );

  return app;
}

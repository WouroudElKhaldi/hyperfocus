// Job applications: keep the jobs she is eyeing or has applied for, and link the emails she sent for each one.

export const JOB_STATUSES = ["wishlist", "applied", "interview", "offer", "rejected", "withdrawn"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const err = (status, message) => Object.assign(new Error(message), { status });
const emailPick = { id: true, subject: true, toAddr: true, status: true, sentAt: true, updatedAt: true };

// Only the fields she may edit by hand. Anything not sent stays as it was.
function fields(b, partial) {
  const out = {};
  for (const k of ["company", "title", "url", "location", "salary", "source", "contactName", "contactEmail", "notes"]) {
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

export function registerJobs(app, prisma, wrap) {
  const id = (req) => Number(req.params.id);
  app.get("/api/jobs", wrap(async (_, res) => {
    const rows = await prisma.jobApplication.findMany({ orderBy: { updatedAt: "desc" }, include: { emails: { select: { id: true, status: true, sentAt: true } } } });
    res.json(rows.map(({ emails, ...j }) => ({ ...j, emailCount: emails.length, lastSentAt: emails.filter((e) => e.sentAt).map((e) => e.sentAt).sort().pop() || null })));
  }));
  app.post("/api/jobs", wrap(async (req, res) => res.json(await prisma.jobApplication.create({ data: fields(req.body || {}, false) }))));
  app.get("/api/jobs/:id", wrap(async (req, res) => {
    const j = await prisma.jobApplication.findUnique({ where: { id: id(req) }, include: { emails: { select: emailPick, orderBy: { updatedAt: "desc" } } } });
    if (!j) return res.status(404).json({ error: "Job not found." });
    res.json(j);
  }));
  app.patch("/api/jobs/:id", wrap(async (req, res) => {
    const data = fields(req.body || {}, true);
    // moving it to "applied" for the first time stamps today, so the date is never empty
    const cur = await prisma.jobApplication.findUnique({ where: { id: id(req) } });
    if (!cur) return res.status(404).json({ error: "Job not found." });
    if (data.status && data.status !== "wishlist" && !cur.appliedAt && data.appliedAt === undefined) data.appliedAt = new Date();
    res.json(await prisma.jobApplication.update({ where: { id: cur.id }, data }));
  }));
  app.delete("/api/jobs/:id", wrap(async (req, res) => { await prisma.jobApplication.deleteMany({ where: { id: id(req) } }); res.json({ ok: true }); })); // emails stay, just unlinked

  // link an email to a job (jobId) or unlink it (jobId null). Works on sent emails too, which is the whole point.
  app.put("/api/emails/:id/job", wrap(async (req, res) => {
    const jobId = req.body.jobId == null || req.body.jobId === "" ? null : Number(req.body.jobId);
    if (jobId !== null && !(await prisma.jobApplication.findUnique({ where: { id: jobId } }))) throw err(404, "Job not found.");
    const mail = await prisma.email.update({ where: { id: id(req) }, data: { jobId }, select: emailPick }).catch(() => null);
    if (!mail) throw err(404, "Email not found.");
    if (jobId !== null && mail.status === "sent") await jobSent(prisma, { jobId, sentAt: mail.sentAt });
    res.json({ ...mail, jobId });
  }));

  // start an application email for a job: a draft already linked, addressed and titled
  app.post("/api/jobs/:id/email", wrap(async (req, res) => {
    const j = await prisma.jobApplication.findUnique({ where: { id: id(req) } });
    if (!j) return res.status(404).json({ error: "Job not found." });
    const subject = `Application: ${j.title || "Open position"}${j.company ? ` at ${j.company}` : ""}`.slice(0, 300);
    res.json(await prisma.email.create({ data: { jobId: j.id, toAddr: j.contactEmail, subject } }));
  }));
}

// called when an email is sent or linked, so a job with a sent email flips to "applied" by itself
export async function jobSent(prisma, email) {
  if (!email.jobId) return;
  const job = await prisma.jobApplication.findUnique({ where: { id: email.jobId } });
  if (job && job.status === "wishlist") await prisma.jobApplication.update({ where: { id: job.id }, data: { status: "applied", appliedAt: email.sentAt || new Date() } });
}

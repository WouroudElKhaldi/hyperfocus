import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, body, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { specOf } from "../../radar/match.ts";
import { deadlineToCalendar, prepareTask, skillGaps } from "../../radar/tie-ins.ts";
import { httpError } from "../../types.ts";

// Your Job Radar matches (P6-25, P6-26, P6-27): the best first, with the posting and why it fits. Save it, say "not
// for me", 👍/👎 (which teaches that filter which skills matter to you), or Apply: it becomes a Job application in your
// Jobs list (with the link, the company and where it is), and the pet is pleased (JobApplied). P6-30: saving puts its
// closing day on your calendar with a reminder; "Prepare" makes a task with steps; "Skill gaps" fills your Skills map.

const NOT_FOUND = "Match not found.";
const STATUSES = ["new", "seen", "saved", "dismissed", "applied"] as const;

const Posting = z.object({
  id: z.number(), title: z.string(), company: z.string(), url: z.string(), locationText: z.string(), countryCode: z.string(),
  workMode: z.string().nullable(), employmentType: z.string().nullable(), seniority: z.string().nullable(),
  salaryMin: z.number().nullable(), salaryMax: z.number().nullable(), salaryCurrency: z.string(), salaryPeriod: z.string(),
  postedAt: z.string(), expiresAt: z.string(), source: z.string().openapi({ description: "The source to name: \"via Arbeitnow\"" }),
  description: z.string(),
}).openapi("RadarPosting");
const Match = z.object({
  id: z.number(), filterId: z.number(), filterName: z.string(), score: z.number(), reasons: z.array(z.string()),
  status: z.enum(STATUSES), feedback: z.number(), applicationId: z.number().nullable(),
  eventId: z.number().nullable().openapi({ description: "Its closing day on your calendar (P6-30)" }), taskId: z.number().nullable().openapi({ description: "Its \"Prepare\" task" }),
  createdAt: z.string(), posting: Posting,
}).openapi("RadarMatch");

const SOURCE_NAMES: Record<string, string> = { arbeitnow: "Arbeitnow", greenhouse: "Greenhouse", lever: "Lever" };
type Row = {
  id: number; filterId: number; score: number; reasons: unknown; status: string; feedback: number; applicationId: number | null; createdAt: Date;
  eventId: number | null; reminderId: number | null; taskId: number | null;
  filter: { name: string };
  posting: { id: number; title: string; company: string; url: string; locationText: string; countryCode: string; workMode: string | null; employmentType: string | null; seniority: string | null; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string; salaryPeriod: string; postedAt: Date; expiresAt: Date; description: string; source: { kind: string; name: string } };
};
const INCLUDE = { filter: { select: { name: true } }, posting: { include: { source: { select: { kind: true, name: true } } } } } as const;
const show = (m: Row) => ({
  id: m.id, filterId: m.filterId, filterName: m.filter.name, score: m.score, reasons: Array.isArray(m.reasons) ? (m.reasons as string[]) : [],
  status: m.status as (typeof STATUSES)[number], feedback: m.feedback, applicationId: m.applicationId, eventId: m.eventId, taskId: m.taskId, createdAt: m.createdAt.toISOString(),
  posting: {
    id: m.posting.id, title: m.posting.title, company: m.posting.company, url: m.posting.url, locationText: m.posting.locationText, countryCode: m.posting.countryCode,
    workMode: m.posting.workMode, employmentType: m.posting.employmentType, seniority: m.posting.seniority, salaryMin: m.posting.salaryMin, salaryMax: m.posting.salaryMax,
    salaryCurrency: m.posting.salaryCurrency, salaryPeriod: m.posting.salaryPeriod, postedAt: m.posting.postedAt.toISOString(), expiresAt: m.posting.expiresAt.toISOString(),
    source: SOURCE_NAMES[m.posting.source.kind] ?? m.posting.source.name, description: m.posting.description.slice(0, 4000),
  },
});

export function radarMatchesRouter({ prisma, events, ai }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const one = async (id: number) => {
    const m = await prisma.jobMatch.findFirst({ where: { id }, include: INCLUDE });
    if (!m) throw httpError(404, NOT_FOUND);
    return m as unknown as Row;
  };

  app.openapi(
    createRoute({
      method: "get", path: "/api/radar/matches", tags: ["Job Radar"], summary: "Your matches, the best first (not dismissed, not expired)",
      request: { query: z.object({ status: z.enum(STATUSES).optional(), filterId: z.coerce.number().int().optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }) },
      responses: { 200: json(z.object({ total: z.number(), items: z.array(Match) }), "Best first") },
    }),
    async (c) => {
      const { status, filterId, limit } = c.req.valid("query");
      // (one match per posting: the same job found by two of your filters shows once, with the better score)
      const where = { ...(status ? { status } : { status: { in: ["new", "seen", "saved"] } }), ...(filterId ? { filterId } : {}), posting: { archivedAt: null } };
      const rows = (await prisma.jobMatch.findMany({ where, include: INCLUDE, orderBy: [{ score: "desc" }, { id: "desc" }], take: limit * 3 })) as unknown as Row[];
      const seen = new Set<number>();
      const items = rows.filter((m) => !seen.has(m.posting.id) && seen.add(m.posting.id)).slice(0, limit).map(show);
      return c.json({ total: await prisma.jobMatch.count({ where }), items }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "patch", path: "/api/radar/matches/{id}", tags: ["Job Radar"], summary: "Seen, save, not for me, or 👍/👎 (teaches the filter)",
      request: { params: IdParam, body: body(z.object({ status: z.enum(["new", "seen", "saved", "dismissed"]).optional(), feedback: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional() })) },
      responses: { 200: json(Match, "The match"), 404: problem(NOT_FOUND) },
    }),
    async (c) => {
      const id = pathId(c.req.param("id"), NOT_FOUND);
      const { status, feedback } = c.req.valid("json");
      const m = await one(id);
      if (feedback !== undefined && feedback !== m.feedback) {
        // P6-26: the skills this posting asks for, that the filter looks for, matter more (👍) or less (👎) to you
        const filter = await prisma.jobFilter.findFirst({ where: { id: m.filterId }, select: { spec: true, weights: true } });
        const skills = await prisma.jobPostingSkill.findMany({ where: { postingId: m.posting.id }, select: { skillId: true } });
        const codes = new Set((await prisma.taxonomySkill.findMany({ where: { id: { in: skills.map((s) => s.skillId) } }, select: { code: true } })).map((s) => s.code));
        if (filter) {
          const spec = specOf(filter.spec);
          const weights = { ...((filter.weights ?? {}) as Record<string, number>) };
          const step = feedback - m.feedback; // (changing your mind undoes the earlier one)
          for (const s of [...spec.skills.must, ...spec.skills.nice]) {
            if (!codes.has(s.code)) continue;
            const w = (weights[s.code] ?? 1) * 1.25 ** step;
            weights[s.code] = Math.round(Math.min(3, Math.max(0.2, w)) * 1000) / 1000;
          }
          await prisma.jobFilter.updateMany({ where: { id: m.filterId }, data: { weights } });
        }
      }
      await prisma.jobMatch.updateMany({
        where: { id },
        data: { ...(status ? { status } : {}), ...(feedback !== undefined ? { feedback } : {}), ...(feedback === -1 && !status ? { status: "dismissed" } : {}) },
      });
      if (status === "saved") await deadlineToCalendar(prisma, m); // P6-30 (once)
      return c.json(show(await one(id)), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/radar/matches/{id}/apply", tags: ["Job Radar"], summary: "Apply: it becomes a Job application in your Jobs list",
      request: { params: IdParam },
      responses: { 200: json(z.object({ match: Match, applicationId: z.number() }), "The match and its new application"), 404: problem(NOT_FOUND) },
    }),
    async (c) => {
      const m = await one(pathId(c.req.param("id"), NOT_FOUND));
      if (m.applicationId) return c.json({ match: show(m), applicationId: m.applicationId }, 200); // (a second click does nothing new)
      const p = m.posting;
      const salary = p.salaryMin ? `${p.salaryCurrency} ${p.salaryMin.toLocaleString("en")}${p.salaryMax ? `–${p.salaryMax.toLocaleString("en")}` : ""}${p.salaryPeriod ? ` a ${p.salaryPeriod}` : ""}` : "";
      const application = await prisma.jobApplication.create({
        data: { company: p.company || "(company)", title: p.title, url: p.url, location: p.locationText, salary, source: `Job Radar · via ${SOURCE_NAMES[p.source.kind] ?? p.source.name}`, status: "wishlist", notes: `Why it fits: ${(Array.isArray(m.reasons) ? (m.reasons as string[]) : []).join(" · ")}` },
      });
      await prisma.jobMatch.updateMany({ where: { id: m.id }, data: { status: "applied", applicationId: application.id } });
      await events.publish("JobApplied", { matchId: m.id, applicationId: application.id, title: p.title });
      return c.json({ match: show(await one(m.id)), applicationId: application.id }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/radar/matches/{id}/prepare", tags: ["Job Radar"], summary: "Prepare: a task with small steps to get the application out (P6-30)",
      request: { params: IdParam },
      responses: { 200: json(z.object({ taskId: z.number(), ai: z.boolean().openapi({ description: "The steps were written by the AI" }) }), "The task"), 404: problem(NOT_FOUND) },
    }),
    async (c) => {
      const m = await one(pathId(c.req.param("id"), NOT_FOUND));
      await deadlineToCalendar(prisma, m);
      return c.json(await prepareTask(prisma, ai, m), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/radar/matches/{id}/skill-gaps", tags: ["Job Radar"], summary: "The skills this job asks for that you don't have yet go on your Skills map (P6-30)",
      request: { params: IdParam },
      responses: { 200: json(z.object({ added: z.array(z.string()), have: z.array(z.string()) }), "What was added, and what you already have"), 404: problem(NOT_FOUND) },
    }),
    async (c) => c.json(await skillGaps(prisma, await one(pathId(c.req.param("id"), NOT_FOUND))), 200),
  );
  return app;
}

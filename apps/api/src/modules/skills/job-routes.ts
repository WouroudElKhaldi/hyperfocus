import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { findJob, skillsForJob } from "../../taxonomy/job-skills.ts";
import { httpError } from "../../types.ts";

// Skills for my job: say your job title (or the job you want) once; the skills and tools it needs come from the shared
// job list, and you add the ones you want to your Skills map, linked to the standard skill. Works without the AI; with
// your own DeepSeek key, a title nobody had before gets its skills named once, for everyone.

const Job = z.object({ code: z.string(), title: z.string() }).openapi("Job");
const JobSkill = z.object({ code: z.string(), name: z.string(), type: z.string(), hot: z.boolean(), have: z.boolean().openapi({ description: "Already on your Skills map" }) }).openapi("JobSkill");
const ForJob = z.object({ job: Job.nullable(), skills: z.array(JobSkill) }).openapi("SkillsForJob");

export function jobSkillsRouter({ prisma, ai, aiReady }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });

  /** The skills of a job, each marked when it is already on your map. */
  const forJob = async (code: string) => {
    const found = code ? await skillsForJob(prisma, code) : null;
    if (!found) return { job: null, skills: [] };
    const mine = await prisma.skill.findMany({ select: { name: true, taxonomyCode: true } });
    const codes = new Set(mine.map((s) => s.taxonomyCode).filter(Boolean));
    const names = new Set(mine.map((s) => s.name.trim().toLowerCase()));
    return { job: found.job, skills: found.skills.map((s) => ({ ...s, have: codes.has(s.code) || names.has(s.name.toLowerCase()) })) };
  };
  const myJob = async () => (await prisma.profile.findFirst({ select: { occupationCode: true } }))?.occupationCode ?? "";

  app.openapi(
    createRoute({ method: "get", path: "/api/skills/for-job", tags: ["Skills"], summary: "The skills and tools your job needs (your job title in your profile, or ?code=)", request: { query: z.object({ code: z.string().max(120).optional() }) }, responses: { 200: json(ForJob, "Your job and its skills (none when no job is set)") } }),
    async (c) => c.json(await forJob(c.req.valid("query").code ?? (await myJob())), 200),
  );

  app.openapi(
    createRoute({
      method: "put", path: "/api/skills/job", tags: ["Skills"], summary: "Set your job title (from the list, or typed): its skills are suggested",
      request: { body: body(z.object({ code: z.string().max(120).optional(), title: z.string().trim().max(120).optional() })) },
      responses: { 200: json(ForJob.extend({ closest: z.array(Job).openapi({ description: "When the title isn't one we know: the closest jobs to pick from" }), learned: z.boolean().openapi({ description: "The AI named this new title's skills (stored for everyone)" }) }), "Your job and its skills") },
    }),
    async (c) => {
      const { code, title } = c.req.valid("json");
      let job: { code: string; title: string } | null = null;
      let closest: { code: string; title: string }[] = [];
      let learned = false;
      if (code) {
        const o = await prisma.occupation.findUnique({ where: { code }, select: { code: true, title: true } });
        if (!o) throw httpError(400, "Pick a job from the list.");
        job = o;
      } else if (title) {
        // the AI only when the person has it (their own key, or the owner's where shared) and nothing else matches
        ({ job, closest, learned } = await findJob(prisma, title, aiReady?.() ? ai : null));
      } else throw httpError(400, "Pick a job from the list, or type your job title.");
      if (job) {
        const p = await prisma.profile.findFirst({ select: { id: true, role: true } });
        const data = { occupationCode: job.code, ...(p?.role ? {} : { role: (title || job.title).slice(0, 80) }) };
        if (p) await prisma.profile.update({ where: { id: p.id }, data });
        else await prisma.profile.create({ data });
      }
      return c.json({ ...(job ? await forJob(job.code) : { job: null, skills: [] }), closest, learned }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/skills/from-job", tags: ["Skills"], summary: "Add skills of your job to your Skills map (linked to the standard skill; ones you have are skipped)",
      request: { body: body(z.object({ codes: z.array(z.string().max(200)).min(1).max(50) })) },
      responses: { 200: json(z.object({ added: z.array(z.string()) }), "What was added") },
    }),
    async (c) => {
      const { codes } = c.req.valid("json");
      const { job, skills } = await forJob(await myJob());
      const wanted = skills.filter((s) => codes.includes(s.code) && !s.have);
      const area = job?.title.slice(0, 60) ?? "My job";
      for (const s of wanted) await prisma.skill.create({ data: { name: s.name, area, target: 3, taxonomyCode: s.code, taxonomyLabel: s.name } });
      return c.json({ added: wanted.map((s) => s.name) }, 200);
    },
  );
  return app;
}

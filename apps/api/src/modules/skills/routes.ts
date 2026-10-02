import { createRoute, z } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import { BulkSkillsInput, CreateSkillInput, Skill, SuggestSkillsInput, UpdateSkillInput } from "@hyperfocus/shared";
import type { AppDeps } from "../../app.ts";
import { IdParam, body, crudRouter, json, pathId, problem } from "../../http/crud.ts";
import { compact, httpError, orNull } from "../../types.ts";

// The skills gap map (P2-09): skills with a level and a target, bulk-adding the ones the AI suggested, and an AI plan for
// one skill. Same answers as the Express routes had, plus the P2 fix: changing or deleting a skill that doesn't exist is a
// 404 "Skill not found." (it was a 500).

const SKILL_404 = "Skill not found.";
const byArea = [{ area: "asc" as const }, { createdAt: "asc" as const }];

const Suggestions = z.object({ skills: z.array(z.object({ name: z.string(), area: z.string(), why: z.string() })) }).openapi("SkillSuggestions");
const Plan = z.object({ steps: z.array(z.string()), books: z.array(z.object({ title: z.string(), author: z.string() })) }).openapi("SkillPlan");

export function skillsRouter({ prisma, events, ai }: AppDeps) {
  const app = crudRouter({
    path: "/api/skills",
    tag: "Skills",
    name: "skill",
    item: Skill,
    create: CreateSkillInput,
    update: UpdateSkillInput,
    notFound: SKILL_404,
    store: {
      list: () => prisma.skill.findMany({ orderBy: byArea }),
      create: ({ name, area, notes, level, target }) => prisma.skill.create({ data: { name, target, ...compact({ area, notes, level }) } }),
      update: async (id, data) => {
        const before = await prisma.skill.findUnique({ where: { id } });
        if (!before) return null;
        const skill = await orNull(prisma.skill.update({ where: { id }, data: compact(data) }));
        if (skill && skill.level > before.level) await events.publish("SkillLevelledUp", { skillId: skill.id, name: skill.name, level: skill.level });
        return skill;
      },
      remove: async (id) => (await prisma.skill.deleteMany({ where: { id } })).count > 0,
    },
  });

  app.openapi(
    createRoute({
      method: "post", path: "/api/skills/bulk", tags: ["Skills"], summary: "Add several skills at once (skips names already tracked)",
      request: { body: body(BulkSkillsInput) }, responses: { 200: json(z.array(Skill), "Every skill, after adding"), 400: problem("The request isn't valid") },
    }),
    async (c) => {
      const existing = new Set((await prisma.skill.findMany({ select: { name: true } })).map((s) => s.name.toLowerCase()));
      const items = (c.req.valid("json").items ?? []).filter((i) => i.name?.trim() && !existing.has(i.name.trim().toLowerCase()));
      await prisma.skill.createMany({ data: items.map((i) => ({ name: (i.name ?? "").trim(), area: i.area || "", notes: i.why || "" })) });
      return c.json(await prisma.skill.findMany({ orderBy: byArea }), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/skills/suggest", tags: ["Skills"], summary: "AI: skills worth working on, from what she describes",
      request: { body: body(SuggestSkillsInput) }, responses: { 200: json(Suggestions, "Suggested skills"), 400: problem("Nothing to go on") },
    }),
    async (c) => {
      const existing = (await prisma.skill.findMany({ select: { name: true } })).map((s) => s.name);
      return c.json({ skills: await ai.run(prompts.suggestSkills, { context: c.req.valid("json").context, existing }) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/skills/{id}/plan", tags: ["Skills"], summary: "AI: steps (and maybe books) to close the gap in one skill",
      request: { params: IdParam }, responses: { 200: json(Plan, "The plan"), 404: problem("No such skill") },
    }),
    async (c) => {
      const s = await prisma.skill.findUnique({ where: { id: pathId(c.req.param("id"), SKILL_404) } });
      if (!s) throw httpError(404, SKILL_404);
      return c.json(await ai.run(prompts.skillPlan, { name: s.name, level: s.level, target: s.target }), 200);
    },
  );

  return app;
}

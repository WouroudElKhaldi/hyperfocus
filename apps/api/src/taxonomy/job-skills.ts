import { type AiGateway, prompts } from "@hyperfocus/ai";
import { makeExtractor } from "../radar/skills.ts";
import type { Db } from "../types.ts";
import { searchTaxonomy } from "./search.ts";

// Skills for a job title, for everyone. The standard job list (O*NET, ~1,000 occupations, and ESCO when imported) says
// which skills and tools each occupation needs; that is shared data in the database. A title someone types is matched
// to the closest standard occupation. Only when nothing matches, and the person has the AI (their own DeepSeek key),
// the AI names the skills once: each is matched to the standard skills (or added as a local one), and the new local
// occupation is stored, so the next person with that title gets it at once, AI or not. Without the AI, they get the
// closest occupations to pick from.

export type JobSkill = { code: string; name: string; type: string; hot: boolean };
export type Job = { code: string; title: string };
const LIMIT = 20;

/** The occupation, and the one it is shown as (an ESCO occupation as its O*NET twin, a merged duplicate). */
async function occupation(db: Db, code: string) {
  const o = await db.occupation.findUnique({ where: { code }, select: { id: true, code: true, title: true, sameAsId: true, sameAs: { select: { id: true, code: true, title: true } } } });
  return o ? { id: o.id, code: o.code, title: o.title, ids: [o.id, ...(o.sameAsId ? [o.sameAsId] : [])] } : null;
}

/** The skills an occupation needs: tools in demand and essential skills first, then by importance. */
export async function skillsForJob(db: Db, code: string, limit = LIMIT): Promise<{ job: Job; skills: JobSkill[] } | null> {
  const o = await occupation(db, code);
  if (!o) return null;
  const links = await db.occupationSkill.findMany({
    where: { occupationId: { in: o.ids }, skill: { type: { in: ["skill", "tool"] } } },
    select: { importance: true, essential: true, skill: { select: { code: true, name: true, type: true, hot: true } } },
  });
  const seen = new Set<string>();
  const skills = links
    .sort((a, b) => Number(b.skill.hot) - Number(a.skill.hot) || Number(b.essential) - Number(a.essential) || b.importance - a.importance || a.skill.name.localeCompare(b.skill.name))
    .map((l) => l.skill)
    .filter((s) => !seen.has(s.code) && seen.add(s.code))
    .slice(0, limit);
  return { job: { code: o.code, title: o.title }, skills };
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/**
 * A job title as typed: the standard occupation it names (exactly, or as one of its titles), else the closest ones.
 * With `ai` (the person's own AI) and no match at all, the AI names its skills once and a local occupation is stored.
 */
export async function findJob(db: Db, title: string, ai: AiGateway | null): Promise<{ job: Job | null; closest: Job[]; learned: boolean }> {
  const text = title.trim().replace(/\s+/g, " ").slice(0, 120);
  if (text.length < 2) return { job: null, closest: [], learned: false };
  const hits = await searchTaxonomy(db, "occupation", text, 5);
  const closest = hits.map((h) => ({ code: h.code, title: h.label }));
  // one of a standard occupation's names, exactly (any case): that occupation, or the one it is shown as
  const named = await db.occupationTitle.findFirst({
    where: { title: { equals: text, mode: "insensitive" } },
    orderBy: { id: "asc" },
    select: { occupation: { select: { code: true, title: true, sameAs: { select: { code: true, title: true } } } } },
  });
  if (named) return { job: named.occupation.sameAs ?? { code: named.occupation.code, title: named.occupation.title }, closest, learned: false };
  // a local occupation made before for this very title
  const local = await db.occupation.findUnique({ where: { code: `local:${slug(text)}` }, select: { code: true, title: true } });
  if (local) return { job: local, closest, learned: false };
  if (!ai || closest.length) return { job: null, closest, learned: false };
  return { job: await learnJob(db, ai, text), closest, learned: true };
}

/** The AI names the skills of a title nobody had; they are matched to the standard skills and stored for everyone. */
async function learnJob(db: Db, ai: AiGateway, title: string): Promise<Job | null> {
  const names = await ai.run(prompts.jobSkills, { title });
  if (!names.length) return null;
  const all = await db.taxonomySkill.findMany({ select: { id: true, type: true, name: true, altLabels: true, hot: true } });
  const byName = new Map<string, number>();
  for (const s of all) for (const l of [s.name, ...s.altLabels]) byName.set(l.toLowerCase(), s.id);
  const extractor = makeExtractor(all);
  const ids: number[] = [];
  for (const name of names) {
    const id = byName.get(name.toLowerCase()) ?? extractor.find(name)[0];
    if (id) ids.push(id);
    else {
      // a skill the standard list doesn't have: added as a local one (kept by every import)
      const s = await db.taxonomySkill.upsert({ where: { code: `local:${slug(name)}` }, create: { code: `local:${slug(name)}`, type: "skill", name, source: "local", version: "ai" }, update: {}, select: { id: true } });
      ids.push(s.id);
    }
  }
  const code = `local:${slug(title)}`;
  const o = await db.occupation.upsert({
    where: { code },
    create: { code, title, description: "Added from a job title someone typed; skills named by the AI and matched to the standard list.", source: "local", version: "ai", titles: { create: { title, kind: "preferred" } } },
    update: {},
    select: { id: true, code: true, title: true },
  });
  const unique = [...new Set(ids)];
  await db.occupationSkill.createMany({ data: unique.map((skillId, i) => ({ occupationId: o.id, skillId, importance: Math.max(1, 5 - i * 0.25), essential: i < 5 })), skipDuplicates: true });
  return { code: o.code, title: o.title };
}

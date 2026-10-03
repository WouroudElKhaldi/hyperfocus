import { type JobFilterSpec, emptyJobFilter } from "@hyperfocus/shared";
import type { Db } from "../types.ts";

// Student starter presets (P6-07): "I study ___" → a ready-made Job Radar filter. From the major's place in the
// taxonomy: the jobs it leads to (CIP–SOC crosswalk), the seniority and contract types a student looks for, and the
// core skills and tools of those jobs. 40 common majors are picked by hand with friendly names; any other field of
// study gets a preset the same way.

export type Major = { code: string; label: string; group: string };

/** The 40 majors students pick most, by hand: friendly names, grouped. (CIP 2020 codes, all checked to lead to jobs.) */
export const MAJORS: Major[] = [
  // technology and data
  { code: "cip:11.0701", label: "Computer Science", group: "Technology and data" },
  { code: "cip:14.0903", label: "Software Engineering", group: "Technology and data" },
  { code: "cip:11.0103", label: "Information Technology", group: "Technology and data" },
  { code: "cip:11.1003", label: "Cybersecurity", group: "Technology and data" },
  { code: "cip:30.7001", label: "Data Science", group: "Technology and data" },
  { code: "cip:27.0101", label: "Mathematics", group: "Technology and data" },
  // engineering and architecture
  { code: "cip:14.1901", label: "Mechanical Engineering", group: "Engineering and architecture" },
  { code: "cip:14.1001", label: "Electrical Engineering", group: "Engineering and architecture" },
  { code: "cip:14.0801", label: "Civil Engineering", group: "Engineering and architecture" },
  { code: "cip:14.0701", label: "Chemical Engineering", group: "Engineering and architecture" },
  { code: "cip:14.3501", label: "Industrial Engineering", group: "Engineering and architecture" },
  { code: "cip:14.0501", label: "Biomedical Engineering", group: "Engineering and architecture" },
  { code: "cip:04.0201", label: "Architecture", group: "Engineering and architecture" },
  // business
  { code: "cip:52.0201", label: "Business Administration", group: "Business" },
  { code: "cip:52.0301", label: "Accounting", group: "Business" },
  { code: "cip:52.0801", label: "Finance", group: "Business" },
  { code: "cip:52.1401", label: "Marketing", group: "Business" },
  { code: "cip:52.1001", label: "Human Resources", group: "Business" },
  { code: "cip:52.0901", label: "Hospitality Management", group: "Business" },
  { code: "cip:45.0601", label: "Economics", group: "Business" },
  // health
  { code: "cip:51.3801", label: "Nursing", group: "Health" },
  { code: "cip:51.1201", label: "Medicine", group: "Health" },
  { code: "cip:51.2001", label: "Pharmacy", group: "Health" },
  { code: "cip:51.2201", label: "Public Health", group: "Health" },
  { code: "cip:51.0401", label: "Dentistry", group: "Health" },
  // sciences
  { code: "cip:26.0101", label: "Biology", group: "Sciences" },
  { code: "cip:40.0501", label: "Chemistry", group: "Sciences" },
  { code: "cip:40.0801", label: "Physics", group: "Sciences" },
  { code: "cip:03.0104", label: "Environmental Science", group: "Sciences" },
  // social sciences, law and education
  { code: "cip:42.0101", label: "Psychology", group: "Society, law and education" },
  { code: "cip:45.1001", label: "Political Science", group: "Society, law and education" },
  { code: "cip:45.0901", label: "International Relations", group: "Society, law and education" },
  { code: "cip:45.1101", label: "Sociology", group: "Society, law and education" },
  { code: "cip:22.0101", label: "Law", group: "Society, law and education" },
  { code: "cip:13.0101", label: "Education", group: "Society, law and education" },
  // communication, arts and humanities
  { code: "cip:09.0101", label: "Communication", group: "Communication, arts and humanities" },
  { code: "cip:09.0401", label: "Journalism", group: "Communication, arts and humanities" },
  { code: "cip:50.0409", label: "Graphic Design", group: "Communication, arts and humanities" },
  { code: "cip:23.0101", label: "English", group: "Communication, arts and humanities" },
  { code: "cip:54.0101", label: "History", group: "Communication, arts and humanities" },
];

export type Preset = { field: { code: string; label: string }; spec: JobFilterSpec; summary: string };

const TOP_JOBS = 8;
/** "Psychologists, All Other": a catch-all, shown after the named jobs */
const isCatchAll = (title: string) => /,\s*All Other$/i.test(title);
const TOP_TOOLS = 6;
const TOP_SKILLS = 4;

/** The preset for a field of study, or null if there is no such field. */
export async function presetForField(db: Db, code: string): Promise<Preset | null> {
  const field = await db.fieldOfStudy.findUnique({ where: { code }, select: { id: true, code: true, title: true } });
  if (!field) return null;
  const label = MAJORS.find((m) => m.code === code)?.label ?? field.title;

  // the jobs it leads to: the ones most specific to this major first (reached from few majors), and among those the
  // ones a new graduate can get (O*NET job zones 2–4) before those needing years of study or experience (zone 5)
  const links = await db.fieldOfStudyOccupation.findMany({
    where: { fieldId: field.id },
    select: { occupation: { select: { id: true, code: true, title: true, jobZone: true, _count: { select: { fields: true } } } } },
  });
  const jobs = links
    .map((l) => l.occupation)
    .sort((a, b) => Number(isCatchAll(a.title)) - Number(isCatchAll(b.title)) || Number(a.jobZone === 5) - Number(b.jobZone === 5) || a._count.fields - b._count.fields || a.title.localeCompare(b.title))
    .slice(0, TOP_JOBS);

  // their core skills and tools: what matters most across these jobs, technologies in demand first
  const needs = jobs.length
    ? await db.occupationSkill.findMany({
        where: { occupationId: { in: jobs.map((j) => j.id) }, skill: { type: { in: ["tool", "skill"] } } },
        select: { importance: true, essential: true, skill: { select: { code: true, name: true, type: true, hot: true } } },
      })
    : [];
  const weight = new Map<string, { code: string; label: string; type: string; hot: boolean; score: number }>();
  for (const n of needs) {
    const w = weight.get(n.skill.code) ?? { code: n.skill.code, label: n.skill.name, type: n.skill.type, hot: n.skill.hot, score: 0 };
    w.score += n.importance + (n.essential ? 0.5 : 0);
    weight.set(n.skill.code, w);
  }
  const ranked = [...weight.values()].sort((a, b) => Number(b.hot) - Number(a.hot) || b.score - a.score || a.label.localeCompare(b.label));
  const tools = ranked.filter((s) => s.type === "tool").slice(0, TOP_TOOLS);
  const skills = ranked.filter((s) => s.type === "skill").sort((a, b) => b.score - a.score).slice(0, TOP_SKILLS);

  const spec: JobFilterSpec = {
    ...emptyJobFilter(),
    occupations: jobs.map((j) => ({ code: j.code, label: j.title })),
    fieldsOfStudy: [{ code: field.code, label }],
    // skills only raise a job's score: a student can't be expected to have them all yet
    skills: { must: [], nice: [...tools, ...skills].map((s) => ({ code: s.code, label: s.label })) },
    seniority: ["student", "intern", "entry", "junior"],
    employmentTypes: ["internship", "student_job", "apprenticeship", "full_time", "part_time"],
    postedWithinDays: 30,
    digest: "daily",
  };
  const summary = jobs.length
    ? `${label}: ${jobs.length} kinds of jobs (like ${jobs.slice(0, 3).map((j) => j.title).join(", ")}), internships and entry-level roles, matched on ${spec.skills.nice.length} core skills.`
    : `${label}: no jobs are linked to it yet; add the jobs you want by hand.`;
  return { field: { code: field.code, label }, spec, summary };
}

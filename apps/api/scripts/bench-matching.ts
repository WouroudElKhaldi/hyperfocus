// pnpm --filter @hyperfocus/api bench:matching   (P6-23 acceptance: 10,000 postings × 10,000 filters)
// The real matching code (passes + score) on generated postings and filters shaped like real ones: a mix of student
// presets, remote-only, keyword and salary filters; postings with titles, skills, places and contract types.
import { emptyJobFilter } from "@hyperfocus/shared";
import { type FilterContext, type PostingForMatch, score } from "../src/radar/match.ts";

const POSTINGS = Number(process.argv[2] ?? 10_000);
const FILTERS = Number(process.argv[3] ?? 10_000);
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)] as T;

const OCC = Array.from({ length: 300 }, (_, i) => `onet:${10 + (i % 40)}-${1000 + i}.00`);
const SKILLS = Array.from({ length: 2000 }, (_, i) => `onet-tech:Skill${i}`);
const WORDS = ["Software", "Data", "Marketing", "Sales", "Nurse", "Engineer", "Analyst", "Designer", "Manager", "Intern", "Developer", "Accountant", "Teacher", "Support"];
const now = new Date();

const postings: PostingForMatch[] = Array.from({ length: POSTINGS }, (_, i) => ({
  id: i + 1, title: `${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)}`, company: `Company ${i % 500}`,
  description: Array.from({ length: 120 }, () => pick(WORDS).toLowerCase()).join(" "),
  countryCode: pick(["LB", "DE", "FR", "GB", "US", ""]), cityId: rnd() < 0.5 ? Math.floor(rnd() * 1000) : null,
  workMode: pick(["remote", "hybrid", "onsite", null]), employmentType: pick(["full_time", "internship", "part_time", "contract", null]),
  seniority: pick(["intern", "entry", "junior", "mid", "senior", null]), educationLevel: pick(["bachelor", "master", null]),
  yearsMin: rnd() < 0.5 ? Math.floor(rnd() * 8) : null, salaryMin: rnd() < 0.3 ? 30000 + Math.floor(rnd() * 70000) : null, salaryMax: null,
  salaryCurrency: "USD", salaryPeriod: "year", visaSponsorship: null, occupationCode: rnd() < 0.6 ? pick(OCC) : null,
  postedAt: new Date(now.getTime() - rnd() * 14 * 86400_000), skillCodes: Array.from({ length: 6 }, () => pick(SKILLS)),
}));
const filters = Array.from({ length: FILTERS }, () => {
  const kind = rnd();
  const occs = Array.from({ length: 8 }, () => pick(OCC));
  const spec = {
    ...emptyJobFilter(),
    occupations: kind < 0.6 ? occs.map((code) => ({ code, label: code })) : [],
    skills: { must: [], nice: Array.from({ length: 10 }, () => ({ code: pick(SKILLS), label: "x" })) },
    seniority: kind < 0.6 ? (["student", "intern", "entry", "junior"] as const).slice() : [],
    employmentTypes: kind < 0.6 ? (["internship", "full_time", "part_time"] as const).slice() : [],
    workModes: kind > 0.8 ? (["remote"] as const).slice() : [],
    keywords: { include: kind > 0.6 && kind < 0.8 ? [pick(WORDS).toLowerCase()] : [], exclude: [], scope: ["title", "description"] as ("title" | "description")[] },
    postedWithinDays: 30,
  };
  const ctx: FilterContext = { occupationTitles: new Map(occs.map((o) => [o, [`${pick(WORDS)} ${pick(WORDS)}`]])), fieldOccupations: new Set() };
  return { spec, ctx };
});

const t = performance.now();
let kept = 0;
for (const f of filters) for (const p of postings) {
  const r = score(f.spec as never, p, f.ctx, {}, now);
  if (r && r.score >= 0.3) kept++;
}
const s = (performance.now() - t) / 1000;
console.log(`${POSTINGS.toLocaleString()} postings × ${FILTERS.toLocaleString()} filters = ${(POSTINGS * FILTERS).toLocaleString()} checks in ${s.toFixed(1)} s (${Math.round((POSTINGS * FILTERS) / s).toLocaleString()} a second); ${kept.toLocaleString()} matches kept`);

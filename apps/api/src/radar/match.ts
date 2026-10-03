import { type JobFilterSpec, JobFilterSpec as SpecSchema } from "@hyperfocus/shared";

// Matching a posting against a filter (P6-21, P6-22). A filter is turned into small specifications: hard ones rule a
// posting out, soft ones only add to its score. Unknown never rules out: a posting that doesn't say its contract type,
// seniority or salary isn't thrown away, it just doesn't get those points. Every match says why, in words people use.
//
// Score (0–1), weights adjusted by 👍/👎 (P6-26):
//   what it is      0.35  the occupation itself, or one of its titles in the posting's title; free-text titles
//   skills          0.30  share of the filter's skills the posting asks for (must-haves count double)
//   words           0.10  keywords found
//   fit             0.15  employment type, seniority, work mode, location, salary, visa: when known and wanted
//   fresh           0.10  newer is better, over 30 days
//
// It runs millions of times (every new posting × every filter, P6-23): each posting's text is folded (lower case, no
// accents) once, and each filter phrase once; the rest is set lookups.

export type PostingForMatch = {
  id: number;
  title: string;
  company: string;
  description: string;
  countryCode: string;
  cityId: number | null;
  workMode: string | null;
  employmentType: string | null;
  seniority: string | null;
  educationLevel: string | null;
  yearsMin: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  visaSponsorship: boolean | null;
  occupationCode: string | null;
  postedAt: Date;
  skillCodes: string[];
};

/** What a filter needs from the taxonomy, looked up once: its occupations' titles, its majors' occupations. */
export type FilterContext = { occupationTitles: Map<string, string[]>; fieldOccupations: Set<string> };
export type Weights = Record<string, number>; // skill code → weight learned from 👍/👎 (default 1)
export type MatchResult = { score: number; reasons: string[] };

const EDUCATION = ["none", "secondary", "vocational", "associate", "bachelor", "master", "doctorate"];
const LABEL: Record<string, string> = {
  full_time: "Full time", part_time: "Part time", internship: "Internship", apprenticeship: "Apprenticeship", contract: "Contract",
  freelance: "Freelance", volunteer: "Volunteer", student_job: "Student job", student: "Student", intern: "Intern", entry: "Entry level",
  junior: "Junior", mid: "Mid level", senior: "Senior", lead: "Lead", remote: "Remote", hybrid: "Hybrid", onsite: "On site",
};
const DAY = 24 * 3600_000;
const ACCENTS = /[̀-ͯ]/g;

const foldText = (s: string) => s.toLowerCase().normalize("NFKD").replace(ACCENTS, "");
const phrases = new Map<string, string>();
/** A filter's phrase, folded (remembered: the same few phrases are looked for in every posting). */
function foldPhrase(s: string): string {
  let f = phrases.get(s);
  if (f === undefined) {
    f = foldText(s).trim();
    if (phrases.size > 50_000) phrases.clear();
    phrases.set(s, f);
  }
  return f;
}
type Prepared = { title: string; body: string; skills: Set<string> };
const prepared = new WeakMap<PostingForMatch, Prepared>();
/** A posting's folded title and text and its skill set, made once per posting. */
function prep(p: PostingForMatch): Prepared {
  let x = prepared.get(p);
  if (!x) {
    x = { title: foldText(p.title), body: foldText(p.description), skills: new Set(p.skillCodes) };
    prepared.set(p, x);
  }
  return x;
}
/** The folded text a filter's keywords look in (its scope). */
const scoped = (spec: JobFilterSpec, x: Prepared) =>
  `${spec.keywords.scope.includes("title") ? x.title : ""}\n${spec.keywords.scope.includes("description") || spec.keywords.scope.includes("requirements") ? x.body : ""}`;
const isWordChar = (c: string | undefined) => !!c && ((c >= "a" && c <= "z") || (c >= "0" && c <= "9"));
/** A phrase as a whole word in an already-folded text ("java" isn't in "javascript"). */
function hasPhrase(text: string, phrase: string): boolean {
  const p = foldPhrase(phrase);
  if (!p) return false;
  let i = text.indexOf(p);
  while (i >= 0) {
    if (!isWordChar(text[i - 1]) && !isWordChar(text[i + p.length])) return true;
    i = text.indexOf(p, i + 1);
  }
  return false;
}
const sameName = (a: string, b: string) => foldPhrase(a) === foldPhrase(b);
const ago = (d: Date, now: Date) => {
  const days = Math.floor((now.getTime() - d.getTime()) / DAY);
  return days <= 0 ? "Posted today" : days === 1 ? "Posted yesterday" : `Posted ${days} days ago`;
};

/** Hard rules: does anything the posting says contradict the filter? (Unknown never does.) */
export function passes(spec: JobFilterSpec, p: PostingForMatch, now = new Date()): boolean {
  if (spec.employmentTypes.length && p.employmentType && !spec.employmentTypes.includes(p.employmentType as never)) return false;
  if (spec.seniority.length && p.seniority && !spec.seniority.includes(p.seniority as never)) return false;
  if (spec.workModes.length && p.workMode && !spec.workModes.includes(p.workMode as never)) return false;
  if (spec.educationLevel && p.educationLevel && EDUCATION.indexOf(p.educationLevel) > EDUCATION.indexOf(spec.educationLevel)) return false;
  if (spec.maxYearsExperience !== null && p.yearsMin !== null && p.yearsMin > spec.maxYearsExperience) return false;
  if (spec.visaSponsorship === true && p.visaSponsorship === false) return false;
  if (spec.postedWithinDays !== null && now.getTime() - p.postedAt.getTime() > spec.postedWithinDays * DAY) return false;
  if (spec.salaryMin && p.salaryCurrency === spec.salaryMin.currency && (p.salaryPeriod === "year" || p.salaryPeriod === "") && (p.salaryMax ?? p.salaryMin ?? Number.POSITIVE_INFINITY) < spec.salaryMin.amount) return false;
  if (spec.companies.include.length && !spec.companies.include.some((c) => sameName(c, p.company))) return false;
  if (spec.companies.exclude.length && spec.companies.exclude.some((c) => sameName(c, p.company))) return false;
  if (spec.locations.length) {
    const countries = spec.locations.filter((l) => /^[A-Z]{2}$/.test(l.code)).map((l) => l.code);
    const cities = spec.locations.filter((l) => l.code.startsWith("geonames:")).map((l) => Number(l.code.slice(9)));
    const here = (p.cityId !== null && cities.includes(p.cityId)) || (p.countryCode !== "" && countries.includes(p.countryCode));
    // a remote job with no country is fine for someone who wants remote work
    const remoteAnywhere = p.workMode === "remote" && !p.countryCode && spec.workModes.includes("remote");
    if (!here && !remoteAnywhere && (p.countryCode || p.cityId !== null)) return false;
  }
  const x = prep(p);
  if (spec.skills.must.length && !spec.skills.must.every((s) => x.skills.has(s.code))) return false;
  if (spec.keywords.exclude.length && spec.keywords.exclude.some((w) => hasPhrase(scoped(spec, x), w))) return false;
  return true;
}

/** How well a posting fits (0–1), and why. Null when it doesn't pass, or when the filter asks for something specific
 * (a job, a title, a keyword, a skill, a major) and the posting has none of it. */
export function score(spec: JobFilterSpec, p: PostingForMatch, ctx: FilterContext, weights: Weights = {}, now = new Date()): MatchResult | null {
  if (!passes(spec, p, now)) return null;
  const x = prep(p);
  const reasons: string[] = [];

  // what it is: the occupation, one of its titles in the posting's title, a free-text title, a major's jobs
  let what = 0;
  const jobs: string[] = [];
  for (const o of spec.occupations) {
    if (p.occupationCode === o.code) { what = 1; jobs.push(o.label); continue; }
    if ((ctx.occupationTitles.get(o.code) ?? []).some((t) => hasPhrase(x.title, t))) { what = Math.max(what, 0.8); jobs.push(o.label); }
  }
  for (const t of spec.titles) if (hasPhrase(x.title, t)) { what = Math.max(what, 0.9); jobs.push(t); }
  if (!jobs.length && spec.fieldsOfStudy.length && p.occupationCode && ctx.fieldOccupations.has(p.occupationCode)) {
    what = 0.6;
    jobs.push(`a job ${spec.fieldsOfStudy[0]?.label ?? "your studies"} leads to`);
  }
  if (jobs.length) reasons.push(`Matches: ${[...new Set(jobs)].slice(0, 3).join(", ")}`);

  // skills, must-haves counting double, each weighted by 👍/👎
  let have = 0;
  let total = 0;
  const hit: string[] = [];
  const add = (s: { code: string; label: string }, base: number) => {
    const w = base * (weights[s.code] ?? 1);
    total += w;
    if (x.skills.has(s.code)) { have += w; hit.push(s.label); }
  };
  for (const s of spec.skills.must) add(s, 2);
  for (const s of spec.skills.nice) add(s, 1);
  const skills = total ? have / total : 0;
  if (hit.length) reasons.push(`Skills: ${hit.slice(0, 4).join(", ")}${hit.length > 4 ? ` +${hit.length - 4}` : ""}`);

  // keywords
  const words = spec.keywords.include.length ? spec.keywords.include.filter((w) => hasPhrase(scoped(spec, x), w)) : [];
  const keywordScore = spec.keywords.include.length ? words.length / spec.keywords.include.length : 0;
  if (words.length) reasons.push(`Mentions: ${words.slice(0, 3).join(", ")}`);

  // a filter that asks for something specific needs at least one of it
  const asksWhat = spec.occupations.length + spec.titles.length + spec.keywords.include.length + spec.skills.nice.length + spec.skills.must.length + spec.fieldsOfStudy.length > 0;
  if (asksWhat && what === 0 && have === 0 && words.length === 0) return null;

  // fit: what it says and the filter wants
  let fitHits = 0;
  let fitAsked = 0;
  const fit = (asked: boolean, ok: boolean, label: string) => {
    if (!asked) return;
    fitAsked++;
    if (ok) { fitHits++; reasons.push(label); }
  };
  fit(spec.employmentTypes.length > 0, !!p.employmentType && spec.employmentTypes.includes(p.employmentType as never), LABEL[p.employmentType ?? ""] ?? "");
  fit(spec.seniority.length > 0, !!p.seniority && spec.seniority.includes(p.seniority as never), LABEL[p.seniority ?? ""] ?? "");
  fit(spec.workModes.length > 0, !!p.workMode && spec.workModes.includes(p.workMode as never), LABEL[p.workMode ?? ""] ?? "");
  if (spec.locations.length) {
    const place = spec.locations.find((l) => l.code === p.countryCode || l.code === `geonames:${p.cityId}`);
    fit(true, !!place, place?.label ?? "");
  }
  fit(!!spec.salaryMin, !!spec.salaryMin && (p.salaryMax ?? p.salaryMin ?? 0) >= spec.salaryMin.amount, "Pays enough");
  fit(spec.visaSponsorship === true, p.visaSponsorship === true, "Visa sponsorship");
  const fitScore = fitAsked ? fitHits / fitAsked : 0.5;

  const age = (now.getTime() - p.postedAt.getTime()) / DAY;
  const fresh = Math.max(0, 1 - age / 30);
  reasons.push(ago(p.postedAt, now));

  const total01 = 0.35 * what + 0.3 * skills + 0.1 * keywordScore + 0.15 * fitScore + 0.1 * fresh;
  return { score: Math.round(total01 * 1000) / 1000, reasons: reasons.filter(Boolean) };
}

/** A stored filter's spec, read through today's schema (older saved filters get the new defaults). */
export const specOf = (stored: unknown): JobFilterSpec => SpecSchema.parse(stored ?? {});

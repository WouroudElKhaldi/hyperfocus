import type { Prisma } from "@hyperfocus/db";
import type { JobFilterSpec } from "@hyperfocus/shared";
import { asSystem } from "../tenancy.ts";
import type { Db } from "../types.ts";
import { type FilterContext, type PostingForMatch, type Weights, score, specOf } from "./match.ts";

// Running the matching (P6-23). New postings are matched against every enabled filter of everyone, a batch at a time,
// and marked so they're never matched twice. A new or changed filter is matched against the last 14 days of postings
// at once (backfill). Matches below MIN_SCORE aren't kept. Saved or applied matches are never taken away.

export const MIN_SCORE = 0.3;
export const BACKFILL_DAYS = 14;
const BATCH = 500;
const DAY = 24 * 3600_000;

const POSTING_SELECT = {
  id: true, title: true, company: true, description: true, countryCode: true, cityId: true, workMode: true, employmentType: true,
  seniority: true, educationLevel: true, yearsMin: true, salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true,
  visaSponsorship: true, occupationId: true, postedAt: true,
} as const;

/** Postings as the matcher reads them: with their occupation's code and their skills' codes. */
async function postingsFor(db: Db, where: Prisma.JobPostingWhereInput, take = BATCH): Promise<PostingForMatch[]> {
  const rows = await db.jobPosting.findMany({ where, select: { ...POSTING_SELECT, skills: { select: { skillId: true } } }, orderBy: { id: "asc" }, take });
  const skillIds = [...new Set(rows.flatMap((r) => r.skills.map((s) => s.skillId)))];
  const occIds = [...new Set(rows.map((r) => r.occupationId).filter((x): x is number => x !== null))];
  const [skills, occs] = await Promise.all([
    skillIds.length ? db.taxonomySkill.findMany({ where: { id: { in: skillIds } }, select: { id: true, code: true } }) : [],
    occIds.length ? db.occupation.findMany({ where: { id: { in: occIds } }, select: { id: true, code: true } }) : [],
  ]);
  const skillCode = new Map(skills.map((s) => [s.id, s.code]));
  const occCode = new Map(occs.map((o) => [o.id, o.code]));
  return rows.map(({ skills: s, occupationId, ...r }) => ({
    ...r,
    occupationCode: occupationId === null ? null : (occCode.get(occupationId) ?? null),
    skillCodes: s.map((x) => skillCode.get(x.skillId)).filter((c): c is string => !!c),
  }));
}

/** What a filter needs from the taxonomy: its occupations' titles (and their ESCO twins'), its majors' occupations. */
export async function contextFor(db: Db, spec: JobFilterSpec): Promise<FilterContext> {
  const occupationTitles = new Map<string, string[]>();
  if (spec.occupations.length) {
    const occs = await db.occupation.findMany({
      where: { code: { in: spec.occupations.map((o) => o.code) } },
      select: { code: true, titles: { select: { title: true } }, sameAsOf: { select: { titles: { select: { title: true } } } } },
    });
    for (const o of occs) occupationTitles.set(o.code, [...o.titles, ...o.sameAsOf.flatMap((s) => s.titles)].map((t) => t.title).filter((t) => t.length >= 4));
  }
  const fieldOccupations = new Set<string>();
  if (spec.fieldsOfStudy.length) {
    const links = await db.fieldOfStudyOccupation.findMany({ where: { field: { code: { in: spec.fieldsOfStudy.map((f) => f.code) } } }, select: { occupation: { select: { code: true } } } });
    for (const l of links) fieldOccupations.add(l.occupation.code);
  }
  return { occupationTitles, fieldOccupations };
}

type FilterRow = { id: number; userId: string; spec: unknown; weights: unknown };
type Compiled = { id: number; userId: string; spec: JobFilterSpec; ctx: FilterContext; weights: Weights };

async function compile(db: Db, f: FilterRow): Promise<Compiled> {
  const spec = specOf(f.spec);
  return { id: f.id, userId: f.userId, spec, ctx: await contextFor(db, spec), weights: (f.weights ?? {}) as Weights };
}

/** Matches new postings against every enabled filter (everyone's): one batch. Returns how many matches were made. */
export function matchNewPostings(db: Db, now = new Date()): Promise<number> {
  return asSystem(async () => {
    const postings = await postingsFor(db, { matchedAt: null, duplicateOfId: null, archivedAt: null });
    if (!postings.length) return 0;
    const filters = await Promise.all(
      // (the owner id is left out of results unless asked for by name, as here: each match is written for its filter's owner)
      (await db.jobFilter.findMany({ where: { enabled: true }, select: { id: true, userId: true, spec: true, weights: true } } as never) as unknown as FilterRow[]).map((f) => compile(db, f)),
    );
    const made: Prisma.JobMatchCreateManyInput[] = [];
    for (const f of filters) {
      for (const p of postings) {
        const r = score(f.spec, p, f.ctx, f.weights, now);
        if (r && r.score >= MIN_SCORE) made.push({ userId: f.userId, filterId: f.id, postingId: p.id, score: r.score, reasons: r.reasons });
      }
    }
    let created = 0;
    for (let i = 0; i < made.length; i += 5000) created += (await db.jobMatch.createMany({ data: made.slice(i, i + 5000), skipDuplicates: true })).count;
    await db.jobPosting.updateMany({ where: { id: { in: postings.map((p) => p.id) } }, data: { matchedAt: now } });
    return created;
  });
}

/**
 * Matches one filter against the last 14 days (it was made or changed). Runs as its owner. New matches are added,
 * existing ones get their new score and reasons, and ones it no longer matches go (unless saved or applied).
 */
export async function backfillFilter(db: Db, filterId: number, now = new Date()): Promise<{ added: number; updated: number; removed: number }> {
  const row = await db.jobFilter.findFirst({ where: { id: filterId }, select: { id: true, spec: true, weights: true, enabled: true } });
  if (!row) return { added: 0, updated: 0, removed: 0 };
  const f = await compile(db, { ...row, userId: "" });
  const results = new Map<number, { score: number; reasons: string[] }>();
  if (row.enabled) {
    let after = 0;
    for (;;) {
      const postings = await postingsFor(db, { id: { gt: after }, duplicateOfId: null, archivedAt: null, postedAt: { gte: new Date(now.getTime() - BACKFILL_DAYS * DAY) } });
      if (!postings.length) break;
      for (const p of postings) {
        const r = score(f.spec, p, f.ctx, f.weights, now);
        if (r && r.score >= MIN_SCORE) results.set(p.id, r);
      }
      after = postings[postings.length - 1]?.id ?? after;
    }
  }
  const existing = await db.jobMatch.findMany({ where: { filterId }, select: { id: true, postingId: true, status: true } });
  const have = new Map(existing.map((m) => [m.postingId, m]));
  let updated = 0;
  let removed = 0;
  for (const m of existing) {
    const r = results.get(m.postingId);
    if (r) { await db.jobMatch.update({ where: { id: m.id }, data: { score: r.score, reasons: r.reasons } }); updated++; }
    else if (m.status === "new" || m.status === "seen" || m.status === "dismissed") { await db.jobMatch.delete({ where: { id: m.id } }); removed++; }
  }
  const fresh = [...results.entries()].filter(([postingId]) => !have.has(postingId)).map(([postingId, r]) => ({ filterId, postingId, score: r.score, reasons: r.reasons }));
  const added = fresh.length ? (await db.jobMatch.createMany({ data: fresh, skipDuplicates: true })).count : 0;
  return { added, updated, removed };
}

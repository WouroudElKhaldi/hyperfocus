import { createHash } from "node:crypto";
import type { Prisma } from "@hyperfocus/db";
import type { Db } from "../types.ts";
import { ADAPTERS } from "./adapters.ts";
import { classify } from "./classify.ts";
import type { JobPostingDTO } from "./dto.ts";
import { type Extractor, makeExtractor } from "./skills.ts";

// The ingestion pipeline (P6-11, P6-13): a batch of a source's raw items becomes stored postings. Each item is
// normalised by its source's adapter, classified, placed (country, city), matched to an occupation when its title is
// one, stored (new, changed or unchanged: re-sending the same item changes nothing), checked for being a duplicate of
// a posting already seen (same content, or the same job at the same company with a near-identical title), and its
// skills extracted. A batch is identified by its idempotency key: delivering it again does nothing.

export const KEEP_DAYS = 45;
const DAY = 24 * 3600_000;
const MAX_ERRORS = 20;

export type BatchResult = { batchId: number; replay: boolean; received: number; created: number; updated: number; duplicates: number; failed: number; createdIds: number[] };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\(?\b(m|w|f|d|x|h|all genders?)\s*\/\s*(m|w|f|d|x|h)(\s*\/\s*(m|w|f|d|x|h))?\)?/g, " ").replace(/[^a-z0-9+#]+/g, " ").trim();
export const contentHash = (d: Pick<JobPostingDTO, "title" | "company" | "locationText">) => createHash("sha256").update(`${norm(d.title)}|${norm(d.company)}|${norm(d.locationText)}`).digest("hex");
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 1));
/** How alike two titles are (shared words over all words). */
export function titleSimilarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

// ---------- places (countries and cities from the taxonomy, cached) ----------
type Places = { countries: Map<string, string>; cities: Map<string, { id: number; country: string }> };
let places: { at: number; value: Places } | null = null;
const COUNTRY_ALIASES: Record<string, string> = { uk: "GB", "u.k.": "GB", england: "GB", scotland: "GB", wales: "GB", "great britain": "GB", usa: "US", "u.s.": "US", "u.s.a.": "US", "united states of america": "US", deutschland: "DE", "the netherlands": "NL", holland: "NL", uae: "AE", "south korea": "KR", "czech republic": "CZ", russia: "RU", vietnam: "VN", "viet nam": "VN" };
async function loadPlaces(db: Db): Promise<Places> {
  if (places && Date.now() - places.at < 3600_000) return places.value;
  const countries = new Map<string, string>();
  for (const c of await db.country.findMany({ select: { code: true, name: true } })) countries.set(c.name.toLowerCase(), c.code);
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) if (!countries.has(alias)) countries.set(alias, code);
  const cities = new Map<string, { id: number; country: string }>();
  // the biggest city of a name wins ("Paris" is in France)
  for (const c of await db.city.findMany({ select: { id: true, asciiName: true, countryCode: true }, orderBy: { population: "desc" } })) {
    const k = c.asciiName.toLowerCase();
    if (!cities.has(k)) cities.set(k, { id: c.id, country: c.countryCode });
  }
  places = { at: Date.now(), value: { countries, cities } };
  return places.value;
}
/** The country (and city) a location text names: "Remote, France", "Freiburg (Germany)", "Berlin". */
export function placeOf(text: string, p: Places, given: string | null): { countryCode: string; cityId: number | null } {
  const parts = text.toLowerCase().split(/[;,()/|]| - /).map((s) => s.replace(/\b(remote|hybrid|on-?site|home mix|office)\b/g, "").trim()).filter(Boolean);
  let country = given ?? "";
  let cityId: number | null = null;
  for (const part of parts) {
    const c = p.countries.get(part);
    if (c && !country) country = c;
  }
  for (const part of parts) {
    const city = p.cities.get(part);
    if (city && (!country || city.country === country)) {
      cityId = city.id;
      country ||= city.country;
      break;
    }
  }
  return { countryCode: country, cityId };
}

// ---------- the extractor (rebuilt when the taxonomy changes) ----------
let extractor: { key: string; value: Extractor } | null = null;
async function getExtractor(db: Db): Promise<Extractor> {
  const stats = await db.taxonomySkill.aggregate({ _count: true, _max: { id: true } });
  const key = `${stats._count}:${stats._max.id ?? 0}`;
  if (extractor?.key === key) return extractor.value;
  const skills = await db.taxonomySkill.findMany({ select: { id: true, type: true, name: true, altLabels: true, hot: true } });
  extractor = { key, value: makeExtractor(skills) };
  return extractor.value;
}

/** The occupation a title names, when it is exactly one of the taxonomy's titles ("Senior Data Analyst (m/f/d)" → Data Analysts). */
async function occupationOf(db: Db, title: string): Promise<number | null> {
  const clean = norm(title).replace(/\b(senior|sr|junior|jr|lead|principal|staff|head of|intern|internship|working student|werkstudent|trainee|graduate|entry level|mid level|remote|hybrid)\b/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 3) return null;
  const rows = await db.$queryRaw<{ id: number }[]>`
    SELECT COALESCE(o."sameAsId", o."id") AS id FROM "OccupationTitle" t JOIN "Occupation" o ON o."id" = t."occupationId"
    WHERE lower(t."title") = ${clean} ORDER BY (t."kind" = 'preferred') DESC LIMIT 1`;
  return rows[0]?.id ?? null;
}

type SourceRow = { id: number; key: string; kind: string; config: unknown };

/** Starts a batch: a new key is stored with its items ("queued"); a key seen before is a replay and changes nothing. */
export async function receiveBatch(db: Db, source: SourceRow, items: unknown[], idempotencyKey: string, cursor = ""): Promise<{ batchId: number; replay: boolean }> {
  const before = await db.ingestBatch.findUnique({ where: { idempotencyKey }, select: { id: true } });
  if (before) return { batchId: before.id, replay: true };
  try {
    const b = await db.ingestBatch.create({ data: { sourceId: source.id, idempotencyKey, cursor, received: items.length, items: items as Prisma.InputJsonValue, status: "queued" } });
    return { batchId: b.id, replay: false };
  } catch {
    // (the same key arriving twice at once: the other one stored it)
    const b = await db.ingestBatch.findUniqueOrThrow({ where: { idempotencyKey }, select: { id: true } });
    return { batchId: b.id, replay: true };
  }
}

/** Processes a queued batch, once (several copies of the API may try: only the one that claims it does it). */
export async function processBatch(db: Db, batchId: number, now = new Date()): Promise<BatchResult | null> {
  const claim = await db.ingestBatch.updateMany({ where: { id: batchId, status: "queued" }, data: { status: "processing" } });
  if (claim.count !== 1) return null;
  const batch = await db.ingestBatch.findUniqueOrThrow({ where: { id: batchId }, include: { source: true } });
  const adapter = ADAPTERS[batch.source.kind];
  const config = (batch.source.config ?? {}) as Record<string, string>;
  const items = Array.isArray(batch.items) ? (batch.items as unknown[]) : [];
  const result: BatchResult = { batchId, replay: false, received: items.length, created: 0, updated: 0, duplicates: 0, failed: 0, createdIds: [] };
  const errors: { index: number; message: string }[] = [];
  if (!adapter) {
    await db.ingestBatch.update({ where: { id: batchId }, data: { status: "failed", errors: [{ index: -1, message: `No adapter for ${batch.source.kind}` }], items: [], finishedAt: new Date() } });
    return result;
  }
  const p = await loadPlaces(db);
  const ex = await getExtractor(db);

  for (const [index, item] of items.entries()) {
    let d: JobPostingDTO;
    try {
      d = adapter.normalise(item, config);
    } catch (e) {
      result.failed++;
      if (errors.length < MAX_ERRORS) errors.push({ index, message: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
      continue;
    }
    const c = classify(d);
    const place = placeOf(d.locationText, p, d.countryCode);
    const hash = contentHash(d);
    const fields = {
      url: d.url, title: d.title, company: d.company, description: d.description, locationText: d.locationText,
      countryCode: place.countryCode, cityId: place.cityId, workMode: c.workMode, employmentType: c.employmentType, seniority: c.seniority,
      educationLevel: c.educationLevel, yearsMin: c.yearsMin, salaryMin: c.salary?.min ?? null, salaryMax: c.salary?.max ?? null,
      salaryCurrency: c.salary?.currency ?? "", salaryPeriod: c.salary?.period ?? "", visaSponsorship: c.visaSponsorship,
      postedAt: d.postedAt, expiresAt: d.closesAt ?? new Date(d.postedAt.getTime() + KEEP_DAYS * DAY), contentHash: hash,
      raw: item as Prisma.InputJsonValue,
    };
    const existing = await db.jobPosting.findUnique({ where: { sourceId_externalId: { sourceId: batch.sourceId, externalId: d.externalId } }, select: { id: true, contentHash: true, description: true, url: true, expiresAt: true } });
    let postingId: number;
    if (existing) {
      if (existing.contentHash === hash && existing.description === d.description && existing.url === d.url) continue; // unchanged
      await db.jobPosting.update({ where: { id: existing.id }, data: { ...fields, archivedAt: null } });
      postingId = existing.id;
      result.updated++;
    } else {
      const occupationId = await occupationOf(db, d.title);
      // a duplicate: the same content already seen, or the same company and place with a near-identical title, recently
      const same = await db.jobPosting.findFirst({ where: { contentHash: hash, duplicateOfId: null }, orderBy: { id: "asc" }, select: { id: true } });
      let duplicateOfId = same?.id ?? null;
      if (!duplicateOfId && d.company) {
        const near = await db.jobPosting.findMany({
          where: { company: { equals: d.company, mode: "insensitive" }, countryCode: place.countryCode, duplicateOfId: null, postedAt: { gte: new Date(d.postedAt.getTime() - 30 * DAY), lte: new Date(d.postedAt.getTime() + 30 * DAY) } },
          select: { id: true, title: true }, take: 50, orderBy: { id: "asc" },
        });
        duplicateOfId = near.find((n) => titleSimilarity(n.title, d.title) >= 0.8)?.id ?? null;
      }
      const created = await db.jobPosting.create({ data: { ...fields, sourceId: batch.sourceId, externalId: d.externalId, occupationId, duplicateOfId } });
      postingId = created.id;
      result.created++;
      if (duplicateOfId) result.duplicates++;
      else result.createdIds.push(created.id);
    }
    const skillIds = ex.find(`${d.title}\n${d.description}`, d.company);
    await db.jobPostingSkill.deleteMany({ where: { postingId, via: "dictionary" } });
    if (skillIds.length) await db.jobPostingSkill.createMany({ data: skillIds.map((skillId) => ({ postingId, skillId, via: "dictionary" })), skipDuplicates: true });
  }

  await db.ingestBatch.update({
    where: { id: batchId },
    data: { status: "done", created: result.created, updated: result.updated, duplicates: result.duplicates, failed: result.failed, errors, items: [], finishedAt: new Date() },
  });
  await db.jobSource.update({ where: { id: batch.sourceId }, data: { lastOkAt: now, lastItems: items.length, lastError: errors.length ? `${errors.length} item(s) couldn't be read: ${errors[0]?.message ?? ""}`.slice(0, 500) : "" } });
  return result;
}

/** Every queued batch (a job runs this; a batch received by the API is usually processed at once). */
export async function processQueued(db: Db): Promise<number> {
  // a batch left "processing" by an API that stopped half-way goes back to the queue (its items were kept)
  await db.ingestBatch.updateMany({ where: { status: "processing", createdAt: { lt: new Date(Date.now() - 15 * 60_000) } }, data: { status: "queued" } });
  let n = 0;
  for (const b of await db.ingestBatch.findMany({ where: { status: "queued" }, select: { id: true }, orderBy: { id: "asc" }, take: 20 })) if (await processBatch(db, b.id)) n++;
  return n;
}

import { Prisma } from "@hyperfocus/db";
import type { Db } from "../types.ts";

// Typeahead over the taxonomy (P6-06): a few letters in, the best matches out, typos forgiven, under 50 ms.
// A few small indexed lookups, in this order:
//   1. names that start with it ("soft" → "Software Developers"), the exact name first
//   2. the same with spaces and dashes taken out ("frontend" → "Front End Engineer")
//   3. a word in the name starts with it ("dev" → "Web Developers")
//   4. from 4 letters, and only when 1–3 don't fill the list: names that look alike (typos, pg_trgm)
// Within each, what most people want first: an occupation's main title, skills in demand, big cities.
// An occupation found through any of its titles appears once (an ESCO one as its O*NET twin, P6-05), with the title
// that matched shown next to it.

export const SEARCH_KINDS = ["occupation", "skill", "field", "city", "country", "industry"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];
export type Hit = { id: number | string; code: string; label: string; detail: string };

type Spec = {
  /** the column searched, as SQL */
  col: Prisma.Sql;
  /** the columns `hit` reads, and where they come from */
  columns: Prisma.Sql;
  from: Prisma.Sql;
  /** how to order matches within a tier */
  order: Prisma.Sql;
  /** search names with spaces and dashes taken out too (has an index for it) */
  compact?: boolean;
  hit: (r: Record<string, unknown>) => Hit & { key: string };
};

const likeable = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

const SPECS: Record<SearchKind, Spec> = {
  occupation: {
    col: Prisma.sql`t."title"`,
    compact: true,
    columns: Prisma.sql`COALESCE(c."id", o."id") AS id, COALESCE(c."code", o."code") AS code, COALESCE(c."title", o."title") AS title,
        t."title" AS matched, g."title" AS grp`,
    from: Prisma.sql`"OccupationTitle" t JOIN "Occupation" o ON o."id" = t."occupationId"
      LEFT JOIN "Occupation" c ON c."id" = o."sameAsId"
      LEFT JOIN "OccupationGroup" g ON g."id" = COALESCE(c."groupId", o."groupId")`,
    order: Prisma.sql`(t."kind" = 'preferred') DESC, length(t."title") ASC`,
    hit: (r) => {
      const title = String(r["title"]);
      const matched = String(r["matched"]);
      const also = matched.toLowerCase() === title.toLowerCase() ? "" : `also called "${matched}"`;
      return { key: String(r["id"]), id: Number(r["id"]), code: String(r["code"]), label: title, detail: [also, r["grp"] ? String(r["grp"]) : ""].filter(Boolean).join(" · ") };
    },
  },
  skill: {
    col: Prisma.sql`s."name"`,
    compact: true,
    columns: Prisma.sql`s."id", s."code", s."name", s."type"::text AS type, s."hot"`,
    from: Prisma.sql`"TaxonomySkill" s`,
    order: Prisma.sql`s."hot" DESC, length(s."name") ASC`,
    hit: (r) => ({ key: String(r["id"]), id: Number(r["id"]), code: String(r["code"]), label: String(r["name"]), detail: [String(r["type"]), r["hot"] ? "in demand" : ""].filter(Boolean).join(" · ") }),
  },
  field: {
    col: Prisma.sql`f."title"`,
    columns: Prisma.sql`f."id", f."code", f."title", p."title" AS parent`,
    from: Prisma.sql`"FieldOfStudy" f LEFT JOIN "FieldOfStudy" p ON p."id" = f."parentId"`,
    order: Prisma.sql`f."level" DESC, length(f."title") ASC`,
    hit: (r) => ({ key: String(r["id"]), id: Number(r["id"]), code: String(r["code"]), label: String(r["title"]), detail: r["parent"] && r["parent"] !== r["title"] ? String(r["parent"]) : "" }),
  },
  city: {
    col: Prisma.sql`ci."asciiName"`,
    columns: Prisma.sql`ci."id", ci."name", co."name" AS country`,
    from: Prisma.sql`"City" ci JOIN "Country" co ON co."code" = ci."countryCode"`,
    order: Prisma.sql`ci."population" DESC`,
    hit: (r) => ({ key: String(r["id"]), id: Number(r["id"]), code: `geonames:${r["id"]}`, label: String(r["name"]), detail: String(r["country"]) }),
  },
  country: {
    col: Prisma.sql`co."name"`,
    columns: Prisma.sql`co."code", co."name", co."continent"`,
    from: Prisma.sql`"Country" co`,
    order: Prisma.sql`length(co."name") ASC`,
    hit: (r) => ({ key: String(r["code"]), id: String(r["code"]), code: String(r["code"]), label: String(r["name"]), detail: String(r["continent"]) }),
  },
  industry: {
    col: Prisma.sql`i."title"`,
    columns: Prisma.sql`i."id", i."code", i."title"`,
    from: Prisma.sql`"Industry" i`,
    order: Prisma.sql`length(i."title") ASC`,
    hit: (r) => ({ key: String(r["id"]), id: Number(r["id"]), code: String(r["code"]), label: String(r["title"]), detail: "" }),
  },
};

export async function searchTaxonomy(db: Db, kind: SearchKind, query: string, limit = 10): Promise<Hit[]> {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return [];
  const spec = SPECS[kind];
  const { col } = spec;
  const lower = Prisma.sql`lower(${col})`;
  const compactCol = Prisma.sql`regexp_replace(lower(${col}), '[^a-z0-9]+', '', 'g')`;
  const compact = q.replace(/[^a-z0-9]+/g, "");
  const take = limit * 4;

  const tier = (n: number, exact: Prisma.Sql, where: Prisma.Sql, order: Prisma.Sql = spec.order) =>
    Prisma.sql`(SELECT ${spec.columns}, ${n}::int AS tier, ${exact} AS exact FROM ${spec.from} WHERE ${where} ORDER BY ${order} LIMIT ${take})`;
  const starts = `${likeable(q)}%`;
  const tiers = [tier(1, Prisma.sql`(${lower} = ${q})`, Prisma.sql`${lower} LIKE ${starts}`, Prisma.sql`(${lower} = ${q}) DESC, ${spec.order}`)];
  if (spec.compact && compact.length >= 3) tiers.push(tier(2, Prisma.sql`false`, Prisma.sql`${compactCol} LIKE ${`${compact}%`} AND ${lower} NOT LIKE ${starts}`));
  tiers.push(tier(3, Prisma.sql`false`, Prisma.sql`${col} ILIKE ${`% ${likeable(q)}%`}`));
  const hits = collectHits(await db.$queryRaw<Record<string, unknown>[]>(Prisma.join(tiers, " UNION ALL ")), spec, limit);
  if (hits.length < limit && q.length >= 4) {
    const fuzzy = tier(4, Prisma.sql`false`, Prisma.sql`${col} OPERATOR(public.%) ${q}`, Prisma.sql`public.similarity(${col}, ${q}) DESC, ${spec.order}`);
    for (const h of collectHits(await db.$queryRaw<Record<string, unknown>[]>(fuzzy), spec, limit)) {
      if (hits.length < limit && !hits.some((x) => x.code === h.code)) hits.push(h);
    }
  }
  return hits;
}

function collectHits(rows: Record<string, unknown>[], spec: Spec, limit: number): Hit[] {
  const sorted = [...rows].sort((a, b) => Number(b["exact"]) - Number(a["exact"]) || Number(a["tier"]) - Number(b["tier"]));
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const r of sorted) {
    const { key, ...hit } = spec.hit(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

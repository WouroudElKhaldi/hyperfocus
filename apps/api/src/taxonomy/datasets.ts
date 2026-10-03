import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import type { PrismaClient } from "@hyperfocus/db";
import { NAICS_SECTORS, NAICS_VERSION, SOC_MAJOR_GROUPS, SOC_VERSION, socGroupCode } from "./builtin.ts";
import { type Row, csv, fingerprint, textChunks, tsv, xlsxRows } from "./read.ts";
import { type Changes, add, noChanges, sync } from "./sync.ts";

// One importer per dataset (P6-04). Each reads its files from `dir` (data/taxonomy by default), writes them with
// sync() so a second run changes nothing, and returns what changed per table.

export type Db = PrismaClient;
export type Report = Record<string, Changes>;
type T = Parameters<typeof sync>[0];
const tbl = (x: unknown) => x as T;

async function collect<R>(rows: AsyncIterable<Row>, map: (r: Row) => R | null): Promise<R[]> {
  const out: R[] = [];
  for await (const r of rows) {
    const m = map(r);
    if (m) out.push(m);
  }
  return out;
}
const need = (file: string) => {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run with --download, or see docs/taxonomy.md for where to get it.`);
  return file;
};

// ---------- industries (built in) ----------
export async function importIndustries(db: Db): Promise<Report> {
  const rows = NAICS_SECTORS.map(([code, title]) => ({ code: `naics:${code}`, title, parentId: null, source: "naics", version: NAICS_VERSION }));
  return { Industry: await sync(tbl(db.industry), rows, { key: ["code"], fields: ["title", "version"] }) };
}

// ---------- O*NET ----------
/** "db_30_1_text/…" → "onet-30.1" */
function onetVersion(zip: string): string {
  let v = "";
  unzipSync(fs.readFileSync(zip), { filter: (f) => { v ||= /db_(\d+)_(\d+)/.exec(f.name)?.slice(1, 3).join(".") ?? ""; return false; } });
  return `onet-${v || fingerprint(zip)}`;
}

export async function importOnet(db: Db, dir: string): Promise<Report> {
  const zip = need(path.join(dir, "onet.zip"));
  const version = onetVersion(zip);
  const read = (name: string) => tsv(textChunks(zip, name));
  const report: Report = {};

  // the browse tree: SOC major groups
  report["OccupationGroup"] = await sync(tbl(db.occupationGroup),
    SOC_MAJOR_GROUPS.map(([m, t]) => ({ code: socGroupCode(m), title: `${t} Occupations`, parentId: null, source: "soc", version: SOC_VERSION })),
    { key: ["code"], fields: ["title", "version"] });
  const groupIds = new Map((await db.occupationGroup.findMany({ select: { id: true, code: true } })).map((g) => [g.code, g.id]));

  // occupations, with their job zone
  const zones = new Map((await collect(read("Job Zones.txt"), (r) => [r["O*NET-SOC Code"], Number(r["Job Zone"])] as const)));
  const occupations = await collect(read("Occupation Data.txt"), (r) => {
    const soc = r["O*NET-SOC Code"] ?? "";
    return { code: `onet:${soc}`, title: r["Title"] ?? "", description: r["Description"] ?? "", jobZone: zones.get(soc) ?? null, groupId: groupIds.get(socGroupCode(soc.slice(0, 2))) ?? null, source: "onet", version };
  });
  report["Occupation"] = await sync(tbl(db.occupation), occupations, { key: ["code"], fields: ["title", "description", "jobZone", "groupId", "version"] });
  const occ = new Map((await db.occupation.findMany({ where: { source: "onet" }, select: { id: true, code: true } })).map((o) => [o.code.slice(5), o.id]));

  // every title: the preferred one, alternates, short ones
  const titles: { occupationId: number; title: string; lang: string; kind: string }[] = [];
  for (const o of occupations) titles.push({ occupationId: occ.get(o.code.slice(5)) as number, title: o.title, lang: "en", kind: "preferred" });
  for await (const r of read("Alternate Titles.txt")) {
    const id = occ.get(r["O*NET-SOC Code"] ?? "");
    if (!id) continue;
    if (r["Alternate Title"]) titles.push({ occupationId: id, title: r["Alternate Title"], lang: "en", kind: "alternative" });
    if (r["Short Title"] && r["Short Title"] !== "n/a") titles.push({ occupationId: id, title: r["Short Title"], lang: "en", kind: "short" });
  }
  report["OccupationTitle"] = await sync(tbl(db.occupationTitle), titles, { key: ["occupationId", "lang", "title"], fields: [], whereOf: (t) => ({ occupationId_lang_title: { occupationId: t.occupationId, lang: t.lang, title: t.title } }) });

  // skills and knowledge (importance on the 1–5 "IM" scale), and technologies
  const skills = new Map<string, { code: string; type: "skill" | "knowledge" | "tool"; name: string; altLabels: string[]; hot: boolean; source: string; version: string }>();
  const links: { code: string; soc: string; importance: number; essential: boolean }[] = [];
  for (const [file, type] of [["Skills.txt", "skill"], ["Knowledge.txt", "knowledge"]] as const) {
    for await (const r of read(file)) {
      if (r["Scale ID"] !== "IM" || r["Recommend Suppress"] === "Y") continue;
      const code = `onet:${r["Element ID"]}`;
      if (!skills.has(code)) skills.set(code, { code, type, name: r["Element Name"] ?? "", altLabels: [], hot: false, source: "onet", version });
      const v = Number(r["Data Value"]);
      links.push({ code, soc: r["O*NET-SOC Code"] ?? "", importance: Math.round(((v - 1) / 4) * 1000) / 1000, essential: v >= 3.5 });
    }
  }
  for await (const r of read("Technology Skills.txt")) {
    const name = r["Example"] ?? "";
    if (!name) continue;
    const code = `onet-tech:${name}`;
    const hot = r["Hot Technology"] === "Y";
    const known = skills.get(code);
    if (!known) skills.set(code, { code, type: "tool", name, altLabels: [], hot, source: "onet", version });
    else if (hot) known.hot = true;
    links.push({ code, soc: r["O*NET-SOC Code"] ?? "", importance: hot ? 0.7 : 0.5, essential: r["In Demand"] === "Y" });
  }
  report["TaxonomySkill"] = await sync(tbl(db.taxonomySkill), [...skills.values()], { key: ["code"], fields: ["type", "name", "hot", "version"] });
  const skillIds = new Map((await db.taxonomySkill.findMany({ where: { source: "onet" }, select: { id: true, code: true } })).map((s) => [s.code, s.id]));
  const occSkills = links
    .map((l) => ({ occupationId: occ.get(l.soc) as number, skillId: skillIds.get(l.code) as number, importance: l.importance, essential: l.essential }))
    .filter((l) => l.occupationId && l.skillId);
  report["OccupationSkill"] = await sync(tbl(db.occupationSkill), occSkills, { key: ["occupationId", "skillId"], fields: ["importance", "essential"], whereOf: (l) => ({ occupationId_skillId: { occupationId: l.occupationId, skillId: l.skillId } }) });
  return report;
}

// ---------- CIP fields of study, and the CIP–SOC crosswalk ----------
export async function importCip(db: Db, dir: string): Promise<Report> {
  const file = need(path.join(dir, "CIPCode2020.csv"));
  const version = "cip-2020";
  const report: Report = {};
  const rows = await collect(csv(textChunks(file)), (r) => {
    const code = (r["CIPCode"] ?? "").trim();
    const action = r["Action"] ?? "";
    if (!code || /^(Deleted|Moved to)/i.test(action)) return null;
    const level = code.includes(".") ? (code.split(".")[1]?.length === 2 ? 2 : 3) : 1;
    const parent = level === 3 ? code.slice(0, 5) : level === 2 ? code.slice(0, 2) : null;
    return { code: `cip:${code}`, title: (r["CIPTitle"] ?? "").replace(/\.$/, "").trim(), description: (r["CIPDefinition"] ?? "").trim(), level, parent, source: "cip", version };
  });
  // parents first, so children can point to them
  const fields = rows.map(({ parent: _p, ...f }) => ({ ...f, parentId: null as number | null }));
  report["FieldOfStudy"] = await sync(tbl(db.fieldOfStudy), fields, { key: ["code"], fields: ["title", "description", "level", "version"] });
  const ids = new Map((await db.fieldOfStudy.findMany({ where: { source: "cip" }, select: { id: true, code: true, parentId: true } })).map((f) => [f.code, f]));
  let relinked = 0;
  for (const r of rows) {
    const me = ids.get(r.code);
    const parentId = r.parent ? (ids.get(`cip:${r.parent}`)?.id ?? null) : null;
    if (me && me.parentId !== parentId) {
      await db.fieldOfStudy.update({ where: { id: me.id }, data: { parentId } });
      relinked++;
    }
  }
  (report["FieldOfStudy"] as Changes).updated += relinked;

  // major → occupations: a SOC code reaches every O*NET occupation under it ("29-1141" → Registered Nurses and its
  // specialities). Except the catch-all "… All Other" codes (ending in 99, like 11-9199 Managers, All Other): O*NET
  // splits those into unrelated specialities (Wind Energy Development Managers…), so they reach only the catch-all itself.
  const xwalk = path.join(dir, "CIP2020_SOC2018_Crosswalk.xlsx");
  if (fs.existsSync(xwalk)) {
    const occs = await db.occupation.findMany({ where: { source: "onet" }, select: { id: true, code: true } });
    const bySoc = new Map<string, number[]>();
    for (const o of occs) {
      const soc = o.code.slice(5, 12);
      if (soc.endsWith("99") && !o.code.endsWith(".00")) continue;
      bySoc.set(soc, [...(bySoc.get(soc) ?? []), o.id]);
    }
    const links: { fieldId: number; occupationId: number }[] = [];
    for (const r of xlsxRows(xwalk, "CIP-SOC")) {
      const field = ids.get(`cip:${r["CIP2020Code"]}`);
      for (const occupationId of bySoc.get(r["SOC2018Code"] ?? "") ?? []) if (field) links.push({ fieldId: field.id, occupationId });
    }
    const changes = await sync(tbl(db.fieldOfStudyOccupation), links, { key: ["fieldId", "occupationId"], fields: [], whereOf: (l) => ({ fieldId_occupationId: l }) });
    // links the crosswalk (or the rule above) no longer makes are taken away
    const wanted = new Set(links.map((l) => `${l.fieldId}:${l.occupationId}`));
    const cipFields = [...ids.values()].map((f) => f.id);
    const stale = (await db.fieldOfStudyOccupation.findMany({ where: { fieldId: { in: cipFields } }, select: { fieldId: true, occupationId: true } })).filter((l) => !wanted.has(`${l.fieldId}:${l.occupationId}`));
    for (let i = 0; i < stale.length; i += 1000) {
      await db.fieldOfStudyOccupation.deleteMany({ where: { OR: stale.slice(i, i + 1000) } });
    }
    changes.updated += stale.length;
    report["FieldOfStudyOccupation"] = changes;
  }
  return report;
}

// ---------- GeoNames: countries and cities ----------
export async function importGeo(db: Db, dir: string): Promise<Report> {
  const countriesFile = need(path.join(dir, "countryInfo.txt"));
  const citiesZip = need(path.join(dir, "cities15000.zip"));
  const version = `geonames-${fingerprint(citiesZip)}`;
  const COUNTRY = ["ISO", "ISO3", "ISO-Numeric", "fips", "Country", "Capital", "Area", "Population", "Continent", "tld", "CurrencyCode", "CurrencyName", "Phone", "Postal Code Format", "Postal Code Regex", "Languages", "geonameid", "neighbours", "EquivalentFipsCode"];
  const countries = await collect(tsv(textChunks(countriesFile), { header: false, columns: COUNTRY }), (r) =>
    r["ISO"] && r["ISO3"] ? { code: r["ISO"], iso3: r["ISO3"], name: r["Country"] ?? "", continent: r["Continent"] ?? "", currency: r["CurrencyCode"] ?? "", languages: r["Languages"] ?? "", version } : null);
  const report: Report = { Country: await sync(tbl(db.country), countries, { key: ["code"], fields: ["name", "continent", "currency", "languages", "version"] }) };
  const known = new Set(countries.map((c) => c.code));
  const CITY = ["geonameid", "name", "asciiname", "alternatenames", "latitude", "longitude", "featureClass", "featureCode", "countryCode", "cc2", "admin1", "admin2", "admin3", "admin4", "population", "elevation", "dem", "timezone", "modified"];
  const cities = await collect(tsv(textChunks(citiesZip, "cities15000.txt"), { header: false, columns: CITY }), (r) =>
    known.has(r["countryCode"] ?? "") ? { id: Number(r["geonameid"]), name: r["name"] ?? "", asciiName: r["asciiname"] ?? "", countryCode: r["countryCode"] ?? "", admin1: r["admin1"] ?? "", lat: Number(r["latitude"]), lng: Number(r["longitude"]), population: Number(r["population"]) || 0, version } : null);
  report["City"] = await sync(tbl(db.city), cities, { key: ["id"], fields: ["name", "asciiName", "admin1", "population", "version"] });
  return report;
}

// ---------- ESCO (CSV download, English) ----------
export async function importEsco(db: Db, dir: string): Promise<Report> {
  const base = path.join(dir, "esco");
  const file = (n: string) => need(path.join(base, n));
  const version = `esco-${fingerprint(file("occupations_en.csv"))}`;
  const labels = (s: string | undefined) => (s ?? "").split(/\n|\|/).map((x) => x.trim()).filter(Boolean);
  const report: Report = {};

  const groups = fs.existsSync(path.join(base, "ISCOGroups_en.csv"))
    ? await collect(csv(textChunks(file("ISCOGroups_en.csv"))), (r) => (r["code"] ? { code: `isco:${r["code"]}`, title: r["preferredLabel"] ?? "", parentId: null, source: "isco", version } : null))
    : [];
  if (groups.length) report["OccupationGroup"] = await sync(tbl(db.occupationGroup), groups, { key: ["code"], fields: ["title", "version"] });
  const groupIds = new Map((await db.occupationGroup.findMany({ where: { source: "isco" }, select: { id: true, code: true } })).map((g) => [g.code, g.id]));

  const occRows = await collect(csv(textChunks(file("occupations_en.csv"))), (r) => (r["conceptUri"] ? r : null));
  const occupations = occRows.map((r) => ({
    code: `esco:${(r["conceptUri"] ?? "").split("/").pop()}`, title: r["preferredLabel"] ?? "", description: r["description"] ?? "",
    jobZone: null, groupId: groupIds.get(`isco:${r["iscoGroup"]}`) ?? null, source: "esco", version,
  }));
  report["Occupation"] = await sync(tbl(db.occupation), occupations, { key: ["code"], fields: ["title", "description", "groupId", "version"] });
  const occ = new Map((await db.occupation.findMany({ where: { source: "esco" }, select: { id: true, code: true } })).map((o) => [o.code, o.id]));
  const titles = occRows.flatMap((r) => {
    const id = occ.get(`esco:${(r["conceptUri"] ?? "").split("/").pop()}`) as number;
    return [{ occupationId: id, title: r["preferredLabel"] ?? "", lang: "en", kind: "preferred" }, ...labels(r["altLabels"]).map((t) => ({ occupationId: id, title: t, lang: "en", kind: "alternative" }))];
  });
  report["OccupationTitle"] = await sync(tbl(db.occupationTitle), titles, { key: ["occupationId", "lang", "title"], fields: [], whereOf: (t) => ({ occupationId_lang_title: { occupationId: t.occupationId, lang: t.lang, title: t.title } }) });

  const skills = await collect(csv(textChunks(file("skills_en.csv"))), (r) =>
    r["conceptUri"] ? { code: `esco:${(r["conceptUri"] ?? "").split("/").pop()}`, type: r["skillType"] === "knowledge" ? "knowledge" : "skill", name: r["preferredLabel"] ?? "", altLabels: labels(r["altLabels"]), hot: false, source: "esco", version } : null);
  report["TaxonomySkill"] = await sync(tbl(db.taxonomySkill), skills, { key: ["code"], fields: ["type", "name", "altLabels", "version"] });
  const skillIds = new Map((await db.taxonomySkill.findMany({ where: { source: "esco" }, select: { id: true, code: true } })).map((s) => [s.code, s.id]));
  const links = await collect(csv(textChunks(file("occupationSkillRelations_en.csv"))), (r) => {
    const occupationId = occ.get(`esco:${(r["occupationUri"] ?? "").split("/").pop()}`);
    const skillId = skillIds.get(`esco:${(r["skillUri"] ?? "").split("/").pop()}`);
    const essential = r["relationType"] === "essential";
    return occupationId && skillId ? { occupationId, skillId, importance: essential ? 0.8 : 0.4, essential } : null;
  });
  report["OccupationSkill"] = await sync(tbl(db.occupationSkill), links, { key: ["occupationId", "skillId"], fields: ["importance", "essential"], whereOf: (l) => ({ occupationId_skillId: { occupationId: l.occupationId, skillId: l.skillId } }) });
  return report;
}

// ---------- ESCO ↔ O*NET (the official crosswalk, P6-05) ----------
/**
 * Marks each ESCO occupation as the same as its O*NET one (Occupation.sameAs), so search and presets show each job
 * once with all its titles. The crosswalk comes as a CSV with the ESCO files (data/taxonomy/esco/); its columns are
 * found by their names (an O*NET code column, an ESCO URI column, and the type of match when there is one). Only
 * exact and close matches count; a broader or narrower match is a different job.
 */
export async function importEscoOnet(db: Db, dir: string): Promise<Report> {
  const base = path.join(dir, "esco");
  const name = fs.existsSync(base) ? fs.readdirSync(base).find((n) => /onet/i.test(n) && n.endsWith(".csv")) : undefined;
  if (!name) throw new Error(`Missing the ESCO–O*NET crosswalk CSV in ${base}. See docs/taxonomy.md.`);
  const rows = await collect(csv(textChunks(path.join(base, name))), (r) => r);
  const cols = Object.keys(rows[0] ?? {});
  const find = (re: RegExp) => cols.find((c) => re.test(c));
  const onetCol = find(/o*?net.*(id|code|soc)/i);
  const escoCol = find(/esco.*(uri|id|code)/i);
  const matchCol = find(/match/i);
  if (!onetCol || !escoCol) throw new Error(`The crosswalk ${name} has no O*NET code or ESCO URI column (it has: ${cols.join(", ")}).`);
  const onet = new Map((await db.occupation.findMany({ where: { source: "onet" }, select: { id: true, code: true } })).map((o) => [o.code.slice(5), o.id]));
  const esco = new Map((await db.occupation.findMany({ where: { source: "esco" }, select: { id: true, code: true, sameAsId: true } })).map((o) => [o.code.slice(5), o]));
  const changes = noChanges();
  const done = new Set<number>();
  for (const r of rows) {
    const match = (matchCol ? r[matchCol] : "exact") ?? "";
    if (matchCol && !/exact|close/i.test(match)) continue;
    const e = esco.get((r[escoCol] ?? "").split("/").pop() ?? "");
    const o = onet.get((r[onetCol] ?? "").trim());
    if (!e || !o || done.has(e.id)) continue;
    done.add(e.id); // (the first exact or close match an ESCO occupation has is kept)
    if (e.sameAsId === o) { changes.unchanged++; continue; }
    await db.occupation.update({ where: { id: e.id }, data: { sameAsId: o } });
    changes.updated++;
  }
  return { Occupation: changes };
}

export const DATASETS = { industries: importIndustries, onet: importOnet, cip: importCip, geo: importGeo, esco: importEsco, "esco-onet": importEscoOnet } as const;
export type Dataset = keyof typeof DATASETS;
/** The order "all" runs them in (CIP links to O*NET occupations, so O*NET first). */
export const ALL: Dataset[] = ["industries", "onet", "cip", "geo", "esco", "esco-onet"];

/** Runs one dataset and records it in TaxonomyImport. */
export async function runImport(db: Db, dataset: Dataset, dir: string): Promise<Report> {
  const run = await db.taxonomyImport.create({ data: { dataset, version: "" } });
  const report = await (DATASETS[dataset] as (db: Db, dir: string) => Promise<Report>)(db, dir);
  const version = await (async () => {
    const tables: Record<Dataset, () => Promise<{ version: string } | null>> = {
      industries: () => db.industry.findFirst({ select: { version: true } }),
      onet: () => db.occupation.findFirst({ where: { source: "onet" }, select: { version: true } }),
      cip: () => db.fieldOfStudy.findFirst({ where: { source: "cip" }, select: { version: true } }),
      geo: () => db.country.findFirst({ select: { version: true } }),
      esco: () => db.occupation.findFirst({ where: { source: "esco" }, select: { version: true } }),
      "esco-onet": async () => ({ version: "esco-onet" }),
    };
    return (await tables[dataset]())?.version ?? "";
  })();
  await db.taxonomyImport.update({ where: { id: run.id }, data: { version, finishedAt: new Date(), changes: report } });
  return report;
}

export const total = (r: Report): Changes => Object.values(r).reduce(add, noChanges());

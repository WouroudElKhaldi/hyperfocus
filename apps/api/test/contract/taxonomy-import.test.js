import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { ALL, runImport, total } from "../../src/taxonomy/datasets.ts";
import { searchTaxonomy } from "../../src/taxonomy/search.ts";
import { MAJORS, presetForField } from "../../src/taxonomy/presets.ts";
import { JobFilterSpec } from "@hyperfocus/shared";
import { get } from "../support/api.js";
import { writeTaxonomyFixtures } from "../support/taxonomy-fixture.js";

// P6-04: the taxonomy importer, on small files in each dataset's real format (O*NET text zip, CIP CSV with Excel's
// ="01" codes, the CIP–SOC Excel sheet, GeoNames, ESCO CSV with quoted line breaks), into a database of its own.
// Acceptance: re-running changes 0 rows. (The full real import is timed in TASKS.md: 15.6 s for 245,000 rows.)

const DB_DIR = fileURLToPath(new URL("../../../../packages/db/", import.meta.url));
const url = new URL(inject("databaseUrl"));
url.searchParams.set("schema", `${url.searchParams.get("schema")}_taxonomy`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-taxonomy-"));
let db;

beforeAll(async () => {
  execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: DB_DIR, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });
  db = new PrismaClient({ datasourceUrl: url.toString() });
  writeTaxonomyFixtures(dir);
}, 120000);
afterAll(async () => {
  await db?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${url.searchParams.get("schema")}" CASCADE`);
  await db?.$disconnect();
});

describe("the taxonomy importer", () => {
  it("imports every dataset, and a second run changes nothing", async () => {
    const first = {};
    for (const d of ALL) first[d] = total(await runImport(db, d, dir));
    expect(first.onet.inserted).toBeGreaterThan(0);
    const again = {};
    for (const d of ALL) again[d] = total(await runImport(db, d, dir));
    for (const d of ALL) expect(again[d], d).toMatchObject({ inserted: 0, updated: 0 });
    expect(await db.taxonomyImport.count()).toBe(ALL.length * 2);
  });

  it("O*NET: occupations in their SOC group, job zone, every title once, skills with importance, hot technologies", async () => {
    const dev = await db.occupation.findUnique({ where: { code: "onet:15-1252.00" }, include: { group: true, titles: true, skills: { include: { skill: true } } } });
    expect(dev).toMatchObject({ title: "Software Developers", jobZone: 4, version: "onet-30.1", group: { code: "soc:15-0000", title: "Computer and Mathematical Occupations" } });
    expect(dev.titles.map((t) => [t.title, t.kind]).sort((a, b) => (a[0] < b[0] ? -1 : 1))).toEqual([["Frontend Engineer", "alternative"], ["SWE", "short"], ["Software Developers", "preferred"], ["Software Engineer", "alternative"]].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    const by = Object.fromEntries(dev.skills.map((s) => [s.skill.name, s]));
    expect(by["Active Learning"]).toMatchObject({ importance: 0.75, essential: true, skill: { type: "skill" } });
    expect(by["Python"]).toMatchObject({ essential: true, skill: { type: "tool", hot: true } });
    expect(by["Git"]).toMatchObject({ essential: false, skill: { hot: false } });
    // a suppressed rating isn't used
    const nurse = await db.occupation.findUnique({ where: { code: "onet:29-1141.00" }, include: { skills: { include: { skill: true } } } });
    expect(nurse.skills.map((s) => s.skill.name)).toEqual(["Medicine and Dentistry"]);
  });

  it("CIP: fields of study in a tree (deleted ones left out, quoted text kept), and the jobs each leads to", async () => {
    const cs = await db.fieldOfStudy.findUnique({ where: { code: "cip:11.0701" }, include: { parent: { include: { parent: true } }, occupations: { include: { occupation: true } } } });
    expect(cs).toMatchObject({ title: "Computer Science", level: 3, description: "A program that focuses on computers, \"computing\", and\ntheir uses.", parent: { code: "cip:11.07", parent: { code: "cip:11", level: 1 } } });
    // a catch-all code reaches only the catch-all itself, not its unrelated specialities
    expect(cs.occupations.map((o) => o.occupation.title).sort()).toEqual(["Managers, All Other", "Software Developers"]);
    expect(await db.fieldOfStudy.count({ where: { code: "cip:11.0799" } })).toBe(0);
  });

  it("GeoNames: countries and their cities (a city of an unknown country is skipped)", async () => {
    expect(await db.country.findUnique({ where: { code: "LB" }, include: { cities: true } })).toMatchObject({ iso3: "LBN", name: "Lebanon", currency: "LBP", cities: [{ name: "Beirut", population: 1916100, lat: 33.89 }] });
    expect(await db.city.count()).toBe(1);
  });

  it("ESCO: occupations with their alternative labels (one per line), skills, essential and optional links", async () => {
    const esco = await db.occupation.findUnique({ where: { code: "esco:aaa-111" }, include: { group: true, titles: true, skills: { include: { skill: true } } } });
    expect(esco).toMatchObject({ title: "software developer", description: "Builds software, carefully.", group: { code: "isco:2512" } });
    expect(esco.titles.map((t) => t.title).sort()).toEqual(["programmer, software", "software developer", "web developer"]);
    expect(Object.fromEntries(esco.skills.map((s) => [s.skill.name, [s.essential, s.skill.type]]))).toEqual({ "use version control": [true, "skill"], algorithms: [false, "knowledge"] });
    expect((await db.taxonomySkill.findUnique({ where: { code: "esco:sss-1" } })).altLabels).toEqual(["git", "svn"]);
  });

  it("ESCO ↔ O*NET: an ESCO occupation is marked the same as its O*NET one (exact or close matches only)", async () => {
    const esco = await db.occupation.findUnique({ where: { code: "esco:aaa-111" }, include: { sameAs: true } });
    expect(esco.sameAs).toMatchObject({ code: "onet:15-1252.00" });
    const nurse = await db.occupation.findUnique({ where: { code: "onet:29-1141.00" }, include: { sameAsOf: true } });
    expect(nurse.sameAsOf).toEqual([]);
  });

  it("a new release only changes what changed", async () => {
    writeTaxonomyFixtures(dir, { developerDescription: "Write and test software." });
    const r = await runImport(db, "onet", dir);
    expect(r.Occupation).toEqual({ inserted: 0, updated: 1, unchanged: 3 }); // (4 occupations in the sample: only the changed one is written)
    expect(total(r)).toMatchObject({ inserted: 0, updated: 1 });
  });
});

// P6-06: typeahead over what was imported above
describe("taxonomy search", () => {
  const labels = async (kind, q) => (await searchTaxonomy(db, kind, q)).map((h) => h.label);
  it("finds by the start of a name, any title, a word in it, or with spaces taken out", async () => {
    expect((await labels("occupation", "soft"))[0]).toBe("Software Developers");
    expect(await searchTaxonomy(db, "occupation", "swe")).toEqual([expect.objectContaining({ label: "Software Developers", detail: expect.stringContaining("also called \"SWE\"") })]);
    expect(await labels("occupation", "frontend")).toEqual(["Software Developers"]); // "Frontend Engineer"
    expect(await labels("occupation", "engineer")).toEqual(["Software Developers"]); // a word in "Software Engineer"
    expect(await labels("skill", "pyt")).toEqual(["Python"]);
    expect((await labels("field", "comp"))[0]).toBe("Computer Science");
    expect(await labels("city", "bei")).toEqual(["Beirut"]);
    expect(await labels("country", "leb")).toEqual(["Lebanon"]);
  });

  it("forgives typos from 4 letters, shows an ESCO job and its O*NET twin once, and ignores 1 letter or wildcards", async () => {
    expect((await labels("occupation", "sofware develper"))[0]).toBe("Software Developers");
    expect((await labels("occupation", "software developer")).filter((l) => /software developer/i.test(l))).toEqual(["Software Developers"]);
    expect(await labels("occupation", "s")).toEqual([]);
    expect(await labels("occupation", "%%")).toEqual([]);
    expect(await labels("occupation", "__")).toEqual([]);
  });

  it("is an API route that checks what it is asked", async () => {
    const r = await get("/api/taxonomy/search?kind=occupation&q=so");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ items: expect.any(Array) });
    expect((await get("/api/taxonomy/search?kind=planets&q=so")).status).toBe(400);
    expect((await get("/api/taxonomy/search?kind=skill&q=so&limit=500")).status).toBe(400);
  });
});

// P6-07: "I study ___" → a ready-made Job Radar filter
describe("student presets", () => {
  it("builds a filter from a field of study: its jobs (named ones before catch-alls), student levels, core skills", async () => {
    const p = await presetForField(db, "cip:11.0701");
    expect(JobFilterSpec.parse(p.spec)).toEqual(p.spec); // a valid filter as it is
    expect(p.field).toEqual({ code: "cip:11.0701", label: "Computer Science" }); // the hand-picked name
    expect(p.spec.occupations.map((o) => o.label)).toEqual(["Software Developers", "Managers, All Other"]);
    expect(p.spec.fieldsOfStudy).toEqual([{ code: "cip:11.0701", label: "Computer Science" }]);
    expect(p.spec.seniority).toEqual(["student", "intern", "entry", "junior"]);
    expect(p.spec.employmentTypes).toContain("internship");
    expect(p.spec.skills.must).toEqual([]); // a student isn't expected to have them all yet
    expect(p.spec.skills.nice[0]).toEqual({ code: "onet-tech:Python", label: "Python" }); // in-demand technology first
    expect(p.spec.skills.nice.map((s) => s.label)).toEqual(expect.arrayContaining(["Git", "Active Learning"]));
    expect(p.summary).toMatch(/^Computer Science: 2 kinds of jobs/);
    expect(await presetForField(db, "cip:99.9999")).toBeNull();
  });

  it("has 40 hand-picked majors, each a CIP programme, no repeats", () => {
    expect(MAJORS).toHaveLength(40);
    expect(new Set(MAJORS.map((m) => m.code)).size).toBe(40);
    for (const m of MAJORS) expect(m.code, m.label).toMatch(/^cip:\d{2}\.\d{4}$/);
  });

  it("are API routes", async () => {
    expect((await get("/api/presets/majors")).body).toHaveLength(40);
    expect((await get("/api/presets/fields/cip:99.9999")).status).toBe(404);
    expect((await get("/api/presets/fields/not-a-code")).status).toBe(400);
  });
});

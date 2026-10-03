import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@hyperfocus/db";
import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { ALL, runImport, total } from "../../src/taxonomy/datasets.ts";
import { searchTaxonomy } from "../../src/taxonomy/search.ts";
import { get } from "../support/api.js";

// P6-04: the taxonomy importer, on small files in each dataset's real format (O*NET text zip, CIP CSV with Excel's
// ="01" codes, the CIP–SOC Excel sheet, GeoNames, ESCO CSV with quoted line breaks), into a database of its own.
// Acceptance: re-running changes 0 rows. (The full real import is timed in TASKS.md: 15.6 s for 245,000 rows.)

const DB_DIR = fileURLToPath(new URL("../../../../packages/db/", import.meta.url));
const url = new URL(inject("databaseUrl"));
url.searchParams.set("schema", `${url.searchParams.get("schema")}_taxonomy`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-taxonomy-"));
let db;

const tsvText = (head, rows) => [head.join("\t"), ...rows.map((r) => r.join("\t"))].join("\r\n") + "\r\n";
function writeFixtures({ developerDescription = "Write software." } = {}) {
  const onet = "db_30_1_text/";
  fs.writeFileSync(path.join(dir, "onet.zip"), zipSync({
    [`${onet}Occupation Data.txt`]: strToU8(tsvText(["O*NET-SOC Code", "Title", "Description"], [["15-1252.00", "Software Developers", developerDescription], ["29-1141.00", "Registered Nurses", "Care for patients."]])),
    [`${onet}Job Zones.txt`]: strToU8(tsvText(["O*NET-SOC Code", "Job Zone", "Date", "Domain Source"], [["15-1252.00", "4", "08/2023", "Analyst"]])),
    [`${onet}Alternate Titles.txt`]: strToU8(tsvText(["O*NET-SOC Code", "Alternate Title", "Short Title", "Source(s)"], [["15-1252.00", "Frontend Engineer", "n/a", "08"], ["15-1252.00", "Software Engineer", "SWE", "08"], ["15-1252.00", "Software Engineer", "SWE", "10"], ["29-1141.00", "Staff Nurse", "RN", "08"]])),
    [`${onet}Skills.txt`]: strToU8(tsvText(["O*NET-SOC Code", "Element ID", "Element Name", "Scale ID", "Data Value", "N", "Standard Error", "Lower CI Bound", "Upper CI Bound", "Recommend Suppress", "Not Relevant", "Date", "Domain Source"],
      [["15-1252.00", "2.A.2.b", "Active Learning", "IM", "4.00", "8", "", "", "", "N", "n/a", "", ""], ["15-1252.00", "2.A.2.b", "Active Learning", "LV", "4.50", "8", "", "", "", "N", "N", "", ""], ["29-1141.00", "2.A.2.b", "Active Learning", "IM", "2.20", "8", "", "", "", "Y", "n/a", "", ""]])),
    [`${onet}Knowledge.txt`]: strToU8(tsvText(["O*NET-SOC Code", "Element ID", "Element Name", "Scale ID", "Data Value", "N", "Standard Error", "Lower CI Bound", "Upper CI Bound", "Recommend Suppress", "Not Relevant", "Date", "Domain Source"],
      [["29-1141.00", "2.C.8.a", "Medicine and Dentistry", "IM", "4.60", "8", "", "", "", "N", "n/a", "", ""]])),
    [`${onet}Technology Skills.txt`]: strToU8(tsvText(["O*NET-SOC Code", "Example", "Commodity Code", "Commodity Title", "Hot Technology", "In Demand"], [["15-1252.00", "Python", "1", "Dev", "Y", "Y"], ["15-1252.00", "Git", "2", "Dev", "N", "N"]])),
  }));
  fs.writeFileSync(path.join(dir, "CIPCode2020.csv"), [
    `"CIPFamily","CIPCode","Action","TextChange","CIPTitle","CIPDefinition","CrossReferences","Examples"`,
    `="11",="11","No substantive changes",no,"COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.","Programs, of all kinds.","",`,
    `="11",="11.07","No substantive changes",no,"Computer Science.","Instructional content is defined in code 11.0701.","",`,
    `="11",="11.0701","No substantive changes",no,"Computer Science.","A program that focuses on computers, ""computing"", and
their uses.","",`,
    `="11",="11.0799","Deleted",no,"Old Thing.","Gone.","",`,
  ].join("\r\n") + "\r\n");
  // the CIP–SOC crosswalk is an Excel file: the smallest real one
  const xml = (s) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`);
  fs.writeFileSync(path.join(dir, "CIP2020_SOC2018_Crosswalk.xlsx"), zipSync({
    "xl/workbook.xml": xml(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Intro" sheetId="1" r:id="rId1"/><sheet name="CIP-SOC" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="ws" Target="worksheets/sheet2.xml"/></Relationships>`),
    "xl/sharedStrings.xml": xml(`<sst><si><t>CIP2020Code</t></si><si><t>SOC2018Code</t></si><si><t>11.0701</t></si><si><t>15-1252</t></si><si><r><t>99-</t></r><r><t>9999</t></r></si></sst>`),
    "xl/worksheets/sheet1.xml": xml(`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Not this one</t></is></c></row></sheetData></worksheet>`),
    "xl/worksheets/sheet2.xml": xml(`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" t="s"><v>4</v></c></row></sheetData></worksheet>`),
  }));
  fs.writeFileSync(path.join(dir, "countryInfo.txt"), "# GeoNames\n#ISO\tISO3\n" + ["LB", "LBN", "422", "LE", "Lebanon", "Beirut", "10400", "6000000", "AS", ".lb", "LBP", "Pound", "961", "", "", "ar-LB,fr-LB,en", "272103", "SY,IL", ""].join("\t") + "\n");
  fs.writeFileSync(path.join(dir, "cities15000.zip"), zipSync({ "cities15000.txt": strToU8([
    ["276781", "Beirut", "Beirut", "Bayrut,Beyrouth", "33.89", "35.49", "P", "PPLC", "LB", "", "04", "", "", "", "1916100", "", "", "Asia/Beirut", "2024-01-01"].join("\t"),
    ["999999", "Atlantis", "Atlantis", "", "0", "0", "P", "PPL", "XX", "", "", "", "", "", "50000", "", "", "", ""].join("\t"),
  ].join("\n")) }));
  fs.mkdirSync(path.join(dir, "esco"), { recursive: true });
  fs.writeFileSync(path.join(dir, "esco", "occupations_en.csv"), [
    "conceptType,conceptUri,iscoGroup,preferredLabel,altLabels,description,code",
    `Occupation,http://data.europa.eu/esco/occupation/aaa-111,2512,software developer,"web developer\nprogrammer, software","Builds software, carefully.",2512.4`,
  ].join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "esco", "skills_en.csv"), [
    "conceptType,conceptUri,skillType,reuseLevel,preferredLabel,altLabels,description",
    `KnowledgeSkillCompetence,http://data.europa.eu/esco/skill/sss-1,skill/competence,sector-specific,use version control,"git\nsvn",""`,
    `KnowledgeSkillCompetence,http://data.europa.eu/esco/skill/sss-2,knowledge,cross-sector,algorithms,,""`,
  ].join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "esco", "occupationSkillRelations_en.csv"), [
    "occupationUri,relationType,skillType,skillUri",
    "http://data.europa.eu/esco/occupation/aaa-111,essential,skill/competence,http://data.europa.eu/esco/skill/sss-1",
    "http://data.europa.eu/esco/occupation/aaa-111,optional,knowledge,http://data.europa.eu/esco/skill/sss-2",
  ].join("\n") + "\n");
  // the official ESCO–O*NET crosswalk (P6-05): an exact match counts, a broader one doesn't
  fs.writeFileSync(path.join(dir, "esco", "ESCO_ONET_crosswalk.csv"), [
    "O*NET Id,O*NET Title,ESCO or ISCO URI,ESCO or ISCO Title,Type of Match",
    "15-1252.00,Software Developers,http://data.europa.eu/esco/occupation/aaa-111,software developer,exactMatch",
    "29-1141.00,Registered Nurses,http://data.europa.eu/esco/occupation/aaa-111,software developer,broadMatch",
  ].join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "esco", "ISCOGroups_en.csv"), "conceptType,conceptUri,code,preferredLabel\nISCOGroup,http://data.europa.eu/esco/isco/C2512,2512,Software developers\n");
}

beforeAll(async () => {
  execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: DB_DIR, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });
  db = new PrismaClient({ datasourceUrl: url.toString() });
  writeFixtures();
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
    expect(cs.occupations.map((o) => o.occupation.title)).toEqual(["Software Developers"]);
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
    writeFixtures({ developerDescription: "Write and test software." });
    const r = await runImport(db, "onet", dir);
    expect(r.Occupation).toEqual({ inserted: 0, updated: 1, unchanged: 1 });
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

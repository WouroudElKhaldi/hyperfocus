import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";

// A small taxonomy in each dataset's real file format (P6-04): O*NET text zip, CIP CSV with Excel's ="01" codes, the
// CIP–SOC Excel sheet, GeoNames, ESCO CSV with quoted line breaks, the ESCO–O*NET crosswalk. Used by the importer test,
// and imported into the browser tests' database so Job Radar has jobs, skills and majors to show.

const tsvText = (head, rows) => [head.join("\t"), ...rows.map((r) => r.join("\t"))].join("\r\n") + "\r\n";
export function writeTaxonomyFixtures(dir, { developerDescription = "Write software." } = {}) {
  const onet = "db_30_1_text/";
  fs.writeFileSync(path.join(dir, "onet.zip"), zipSync({
    [`${onet}Occupation Data.txt`]: strToU8(tsvText(["O*NET-SOC Code", "Title", "Description"], [["15-1252.00", "Software Developers", developerDescription], ["29-1141.00", "Registered Nurses", "Care for patients."], ["11-9199.00", "Managers, All Other", "Manage."], ["11-9199.11", "Brownfield Redevelopment Specialists", "Redevelop."]])),
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
    "xl/sharedStrings.xml": xml(`<sst><si><t>CIP2020Code</t></si><si><t>SOC2018Code</t></si><si><t>11.0701</t></si><si><t>15-1252</t></si><si><r><t>99-</t></r><r><t>9999</t></r></si><si><t>11-9199</t></si></sst>`),
    "xl/worksheets/sheet1.xml": xml(`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Not this one</t></is></c></row></sheetData></worksheet>`),
    "xl/worksheets/sheet2.xml": xml(`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" t="s"><v>4</v></c></row><row r="4"><c r="A4" t="s"><v>2</v></c><c r="B4" t="s"><v>5</v></c></row></sheetData></worksheet>`),
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

/** Imports the small taxonomy into a database (the browser tests' one). */
export async function seedTaxonomy(databaseUrl) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hf-taxonomy-seed-"));
  writeTaxonomyFixtures(dir);
  const { PrismaClient } = await import("@hyperfocus/db");
  const { ALL, runImport } = await import("../../src/taxonomy/datasets.ts");
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    for (const d of ALL) await runImport(db, d, dir);
  } finally {
    await db.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

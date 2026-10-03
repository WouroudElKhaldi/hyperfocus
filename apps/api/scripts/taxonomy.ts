// pnpm taxonomy:import <onet|esco|esco-onet|cip|geo|industries|all> [--download] [--dir data/taxonomy]   (P6-04)
// Imports the open datasets into the taxonomy tables. Running it again with the same files changes nothing.
// --download fetches what can be fetched (O*NET, CIP, GeoNames) into the folder first; ESCO is downloaded by hand
// (see docs/taxonomy.md).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@hyperfocus/db";
import { ALL, DATASETS, type Dataset, runImport, total } from "../src/taxonomy/datasets.ts";

const DOWNLOADS: Partial<Record<Dataset, [string, string][]>> = {
  onet: [["onet.zip", "https://www.onetcenter.org/dl_files/database/db_30_1_text.zip"]],
  cip: [["CIPCode2020.csv", "https://nces.ed.gov/ipeds/cipcode/Files/CIPCode2020.csv"], ["CIP2020_SOC2018_Crosswalk.xlsx", "https://nces.ed.gov/ipeds/cipcode/Files/CIP2020_SOC2018_Crosswalk.xlsx"]],
  geo: [["countryInfo.txt", "https://download.geonames.org/export/dump/countryInfo.txt"], ["cities15000.zip", "https://download.geonames.org/export/dump/cities15000.zip"]],
};

const args = process.argv.slice(2).filter((a) => a !== "import");
const which = args.find((a) => !a.startsWith("--")) ?? "";
const dirArg = args[args.indexOf("--dir") + 1];
const dir = path.resolve(args.includes("--dir") && dirArg ? dirArg : fileURLToPath(new URL("../../../data/taxonomy/", import.meta.url)));
const datasets: Dataset[] = which === "all" ? ALL : which in DATASETS ? [which as Dataset] : [];
if (!datasets.length) {
  console.log("Use: pnpm taxonomy:import <onet|esco|esco-onet|cip|geo|industries|all> [--download] [--dir <folder>]");
  process.exit(1);
}

if (args.includes("--download")) {
  fs.mkdirSync(dir, { recursive: true });
  for (const d of datasets) {
    for (const [name, url] of DOWNLOADS[d] ?? []) {
      const to = path.join(dir, name);
      if (fs.existsSync(to)) continue;
      console.log(`Downloading ${url}`);
      const r = await fetch(url, { headers: { "User-Agent": "Hyperfocus taxonomy importer" } });
      if (!r.ok) throw new Error(`${url} answered ${r.status}`);
      fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
    }
  }
}

const { config } = await import("../src/config.ts");
const db = new PrismaClient({ datasourceUrl: config.databaseUrl });
try {
  for (const d of datasets) {
    if ((d === "esco" || d === "esco-onet") && which === "all" && !fs.existsSync(path.join(dir, "esco", "occupations_en.csv"))) {
      console.log(`${d}: skipped (download the ESCO CSV files into data/taxonomy/esco/, see docs/taxonomy.md)`);
      continue;
    }
    const started = performance.now();
    const report = await runImport(db, d, dir);
    const t = total(report);
    console.log(`${d}: ${t.inserted} added, ${t.updated} changed, ${t.unchanged} unchanged in ${((performance.now() - started) / 1000).toFixed(1)} s`);
    for (const [table, c] of Object.entries(report)) console.log(`  ${table}: +${c.inserted} ~${c.updated} =${c.unchanged}`);
  }
} finally {
  await db.$disconnect();
}

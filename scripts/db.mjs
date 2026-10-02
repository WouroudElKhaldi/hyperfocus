// The local PostgreSQL (P4-01, no Docker: ADR-016), installed on this computer.
//   node scripts/db.mjs setup   creates the app's user and databases (asks once for the PostgreSQL admin password)
//   node scripts/db.mjs check   connects as the app and prints the server version
//   node scripts/db.mjs restore backups/thought-studio-….dump   puts a backup back (replaces what is in the database now)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.PGHOST || "localhost";
const PORT = process.env.PGPORT || "5432";

// psql from PATH, or from the newest PostgreSQL in Program Files
function findPsql() {
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["psql"], { encoding: "utf8" });
  if (which.status === 0) return which.stdout.split(/\r?\n/)[0].trim();
  const base = "C:/Program Files/PostgreSQL";
  const versions = fs.existsSync(base) ? fs.readdirSync(base).filter((v) => /^\d+$/.test(v)).sort((a, b) => b - a) : [];
  for (const v of versions) {
    const p = path.join(base, v, "bin", "psql.exe");
    if (fs.existsSync(p)) return p;
  }
  console.error("Couldn't find psql. Install PostgreSQL from https://www.postgresql.org/download/ (free), then run this again.");
  process.exit(1);
}

const psql = findPsql();
const what = process.argv[2];
if (what === "setup") {
  const file = fileURLToPath(new URL("./db-setup.sql", import.meta.url));
  console.log("Creating the hyperfocus user and databases. PostgreSQL will ask for its admin (postgres) password.");
  const r = spawnSync(psql, ["-h", HOST, "-p", PORT, "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", file], { stdio: "inherit" });
  process.exit(r.status ?? 1);
} else if (what === "restore") {
  // pg_restore sits next to psql; --clean replaces the tables with the backup's, --no-owner keeps them the app's
  const file = process.argv[3];
  if (!file || !fs.existsSync(file)) {
    console.error("Give the backup file: pnpm db:restore backups/thought-studio-2026-10-03_09-00-00.dump");
    process.exit(1);
  }
  const pgRestore = path.join(path.dirname(psql), process.platform === "win32" ? "pg_restore.exe" : "pg_restore");
  console.log(`Restoring ${file} into the hyperfocus database. Stop the app first (scripts\\stop-all.ps1).`);
  const r = spawnSync(pgRestore, ["-h", HOST, "-p", PORT, "-U", "hyperfocus", "-d", "hyperfocus", "--clean", "--if-exists", "--no-owner", file], {
    stdio: "inherit", env: { ...process.env, PGPASSWORD: "hyperfocus-local" },
  });
  if (r.status === 0) console.log("Restored. Start the app again.");
  process.exit(r.status ?? 1);
} else if (what === "check") {
  const r = spawnSync(psql, ["-h", HOST, "-p", PORT, "-U", "hyperfocus", "-d", "hyperfocus", "-tAc", "select version()"], {
    encoding: "utf8", env: { ...process.env, PGPASSWORD: "hyperfocus-local" },
  });
  if (r.status !== 0) {
    console.error(`Can't connect as hyperfocus: ${r.stderr.trim()}\nRun \`pnpm db:setup\` first.`);
    process.exit(1);
  }
  console.log(`Connected: ${r.stdout.trim()}`);
} else {
  console.error("Use: node scripts/db.mjs setup | check");
  process.exit(1);
}

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.ts";
import { type Db, httpError } from "./types.ts";

// Backups are consistent snapshots of the PostgreSQL database (pg_dump, P4-02), stored in <project>/backups.
// Older backups from the SQLite days (.db) are still listed and can be downloaded.
// BACKUP_DIR lets tests (and other setups) keep backups somewhere else
const DIR = config.backupDir ? path.resolve(config.backupDir) : fileURLToPath(new URL("../../../backups/", import.meta.url));
const NAME = /^thought-studio-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.(dump|db)$/; // -2, -3: more than one in a second

// pg_dump: from PG_DUMP, or from the newest PostgreSQL installed in Program Files (Windows), or from PATH
function findPgDump(): string {
  if (process.env["PG_DUMP"]) return process.env["PG_DUMP"];
  const base = "C:/Program Files/PostgreSQL";
  const versions = fs.existsSync(base) ? fs.readdirSync(base).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a)) : [];
  for (const v of versions) {
    const p = path.join(base, v, "bin", "pg_dump.exe");
    if (fs.existsSync(p)) return p;
  }
  return "pg_dump";
}

// the database address without Prisma's own ?schema=… (pg_dump gets the schema as an option instead)
function dumpTarget(url: string): { url: string; schema: string } {
  const u = new URL(url);
  const schema = u.searchParams.get("schema") ?? "public";
  u.search = "";
  return { url: u.toString(), schema };
}

function pgDump(file: string): Promise<void> {
  const { url, schema } = dumpTarget(config.databaseUrl);
  return new Promise((resolve, reject) => {
    // --format=custom: PostgreSQL's compact format, restored with `pnpm db:restore <file>` (pg_restore)
    const child = spawn(findPgDump(), ["--format=custom", `--schema=${schema}`, "--no-owner", `--file=${file}`, url], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => reject(httpError(500, `Couldn't start pg_dump (is PostgreSQL installed?): ${e.message}`)));
    child.on("exit", (code) => (code === 0 ? resolve() : reject(httpError(500, `The backup failed: ${err.trim() || `pg_dump exited with ${code}`}`))));
  });
}
const KEEP = 30; // newest backups kept, older ones are deleted
const AUTO_EVERY_MS = 24 * 3600 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

export const backupDir = () => DIR;

export function listBackups() {
  fs.mkdirSync(DIR, { recursive: true });
  return fs
    .readdirSync(DIR)
    .filter((n) => NAME.test(n))
    .map((name) => {
      const s = fs.statSync(path.join(DIR, name));
      return { name, size: s.size, createdAt: s.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Only ever returns a path for a file this module created (the name is validated), so no path tricks are possible.
export function backupPath(name: string | undefined): string | null {
  return name && NAME.test(name) && fs.existsSync(path.join(DIR, name)) ? path.join(DIR, name) : null;
}

function prune() {
  for (const old of listBackups().slice(KEEP)) fs.rmSync(path.join(DIR, old.name), { force: true });
}

// (prisma stays a parameter so the callers don't change; pg_dump reads the database itself)
export async function createBackup(_prisma: Db): Promise<string> {
  fs.mkdirSync(DIR, { recursive: true });
  // two backups in the same second (the daily one and a click, or two copies of the API) both succeed: -2, -3 …
  // The name is claimed by creating the file ("wx": only if it doesn't exist), so two at once can never pick the same one.
  const base = `thought-studio-${stamp()}`;
  let name = `${base}.dump`;
  for (let n = 2; ; n++) {
    try {
      fs.closeSync(fs.openSync(path.join(DIR, name), "wx"));
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      name = `${base}-${n}.dump`;
    }
  }
  const file = path.join(DIR, name);
  // pg_dump writes a complete, consistent copy even while the app is using the database
  try {
    await pgDump(file);
  } catch (e) {
    fs.rmSync(file, { force: true }); // no empty "backup" left behind
    throw e;
  }
  prune();
  return name;
}

// The automatic backup (a background job, see src/jobs): makes one when the newest backup is more than a day old.
export async function backupIfDue(prisma: Db): Promise<string | null> {
  const newest = listBackups()[0];
  if (newest && Date.now() - new Date(newest.createdAt).getTime() <= AUTO_EVERY_MS) return null;
  const name = await createBackup(prisma);
  console.log("Automatic backup:", name);
  return name;
}

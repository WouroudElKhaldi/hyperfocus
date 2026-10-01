import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Backups are consistent snapshots of the SQLite database, stored in <project>/backups.
// BACKUP_DIR lets tests (and other setups) keep backups somewhere else
const DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : fileURLToPath(new URL("../../backups/", import.meta.url));
const NAME = /^thought-studio-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/;
const KEEP = 30; // newest backups kept, older ones are deleted
const AUTO_EVERY_MS = 24 * 3600 * 1000;

const pad = (n) => String(n).padStart(2, "0");
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
export function backupPath(name) {
  return NAME.test(name || "") && fs.existsSync(path.join(DIR, name)) ? path.join(DIR, name) : null;
}

function prune() {
  for (const old of listBackups().slice(KEEP)) fs.rmSync(path.join(DIR, old.name), { force: true });
}

export async function createBackup(prisma) {
  fs.mkdirSync(DIR, { recursive: true });
  const name = `thought-studio-${stamp()}.db`;
  const file = path.join(DIR, name);
  if (fs.existsSync(file)) {
    const e = new Error("A backup was just made a second ago. Try again in a moment.");
    e.status = 429;
    throw e;
  }
  // VACUUM INTO writes a complete, consistent copy even while the app is using the database
  await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/\\/g, "/").replace(/'/g, "''")}'`);
  prune();
  return name;
}

// Makes a backup on start-up and then every 6 hours, but only when the newest one is more than a day old.
export function startAutoBackup(prisma) {
  const check = async () => {
    try {
      const newest = listBackups()[0];
      if (!newest || Date.now() - new Date(newest.createdAt) > AUTO_EVERY_MS) {
        console.log("Automatic backup:", await createBackup(prisma));
      }
    } catch (e) {
      console.error("Automatic backup failed:", e.message);
    }
  };
  check();
  setInterval(check, 6 * 3600 * 1000);
}

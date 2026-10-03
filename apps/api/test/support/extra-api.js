import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inject } from "vitest";
import { freePort } from "./stack.js";

// An extra API process for a test, on a fresh database of its own (a new schema in the test database, migrated like the
// app's), so the test can use settings the shared one doesn't have (APP_MODE=cloud …) and nothing it does reaches other tests.
// stop() ends the process and removes its schemas.

const SERVER_DIR = fileURLToPath(new URL("../../", import.meta.url));
const DB_DIR = fileURLToPath(new URL("../../../../packages/db/", import.meta.url));
const prismaCli = (args, url, input) =>
  execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), ...args], { cwd: DB_DIR, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", ...(input ? { input } : {}) });

export async function startExtraApi(name, env = {}) {
  const url = new URL(inject("databaseUrl"));
  const schema = `${url.searchParams.get("schema")}_${name}`;
  url.searchParams.set("schema", schema);
  prismaCli(["migrate", "deploy"], url.toString());
  const port = await freePort();
  const tmp = inject("tmpDir");
  const logFile = path.join(tmp, `api-${name}.log`);
  const out = fs.openSync(logFile, "a");
  const child = spawn(process.execPath, ["src/index.ts"], {
    cwd: SERVER_DIR, stdio: ["ignore", out, out],
    env: {
      ...process.env, DATABASE_URL: url.toString(), PORT: String(port), NOTIFY_DRY_RUN: "1", NO_BACKGROUND_JOBS: "1",
      SETTINGS_FILE: path.join(tmp, `settings-${name}.json`), BACKUP_DIR: path.join(tmp, `backups-${name}`),
      GMAIL_USER: " ", GMAIL_APP_KEY: " ", DEEPSEEK_API_KEY: "test-key", DEEPSEEK_URL: `${inject("aiUrl")}/chat/completions`,
      RATE_LIMIT_PER_MINUTE: "1000000", AI_RATE_LIMIT_PER_MINUTE: "1000000", ...env,
    },
  });
  const apiUrl = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null) { child.kill(); await new Promise((r) => child.once("exit", r)); }
    try { prismaCli(["db", "execute", "--url", url.toString(), "--stdin"], url.toString(), `DROP SCHEMA IF EXISTS "${schema}" CASCADE; DROP SCHEMA IF EXISTS "${schema}_jobs" CASCADE;`); } catch { /* gone */ }
  };
  for (const end = Date.now() + 60000; Date.now() < end; ) {
    if (child.exitCode !== null) break;
    try { if ((await fetch(`${apiUrl}/api/health`)).ok) return { url: apiUrl, dbUrl: url.toString(), schema, logFile, log: () => fs.readFileSync(logFile, "utf8"), stop }; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  await stop();
  throw new Error(`An extra API (${name}) did not start:\n${fs.readFileSync(logFile, "utf8")}`);
}

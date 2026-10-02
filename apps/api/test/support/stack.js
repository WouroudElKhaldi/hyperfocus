import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeAi, startFakeBooks, startFakeN8n } from "./fakes.js";

// Starts the real API as a separate process against a throwaway database, settings file and backup folder,
// with every outside service replaced by a local fake. Your real data, backups and accounts are never touched.
// Used by the API tests (vitest global setup) and the browser tests (Playwright).

const SERVER_DIR = fileURLToPath(new URL("../../", import.meta.url));
const DB_DIR = fileURLToPath(new URL("../../../../packages/db/", import.meta.url));
// The tests' own PostgreSQL database (P4-02, made by `pnpm db:setup`). Each test run gets a fresh schema in it, removed
// afterwards, so runs never see each other's data, and nothing ever touches the app's own database.
const TEST_DB = process.env.TEST_DATABASE_URL || "postgresql://hyperfocus:hyperfocus-local@localhost:5432/hyperfocus_test";
const prismaCli = (args, env, input) =>
  execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), ...args], { cwd: DB_DIR, env, stdio: "pipe", ...(input ? { input } : {}) });

export const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

// Up to a minute: right after a restart the first start is slow (Node, Prisma and the virus scanner all start cold).
async function waitForHealth(url, child, log, ms = 60000) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (child.exitCode !== null) break;
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`The API did not start. Its output:\n${fs.readFileSync(log, "utf8")}`);
}

export async function startTestStack({ port } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hyperfocus-test-"));
  const schema = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!new URL(TEST_DB).pathname.endsWith("_test")) throw new Error(`Refusing to run the tests against ${new URL(TEST_DB).pathname}: the test database's name must end in _test.`);
  const [ai, n8n, books, apiPort] = await Promise.all([startFakeAi(), startFakeN8n(), startFakeBooks(), port ?? freePort()]);

  const env = {
    ...process.env,
    DATABASE_URL: `${TEST_DB}?schema=${schema}`,
    PORT: String(apiPort),
    DEEPSEEK_URL: `${ai.url}/chat/completions`,
    DEEPSEEK_API_KEY: "test-key",
    N8N_WEBHOOK_URL: `${n8n.url}/webhook`,
    BOOK_SOURCES_URL: books.url,
    // the suite sends hundreds of requests a minute from one address; the limits themselves are unit-tested
    RATE_LIMIT_PER_MINUTE: "1000000",
    AI_RATE_LIMIT_PER_MINUTE: "1000000",
    NOTIFY_DRY_RUN: "1",
    SETTINGS_FILE: path.join(tmp, "settings.json"),
    BACKUP_DIR: path.join(tmp, "backups"),
    // a space is "set" (so the real .env can't fill it in) but trims to empty, so Gmail counts as not configured
    GMAIL_USER: " ",
    GMAIL_APP_KEY: " ",
    GOOGLE_BOOKS_API_KEY: " ",
  };
  delete env.DEMO_MODE;

  // a run that was killed (not stopped) leaves its schemas behind: each run clears those older than an hour
  prismaCli(["db", "execute", "--url", TEST_DB, "--stdin"], env, `DO $$ DECLARE s text; BEGIN
    FOR s IN SELECT schema_name FROM information_schema.schemata
      WHERE schema_name ~ '^run_[0-9]+_' AND split_part(schema_name, '_', 2)::bigint < extract(epoch FROM now()) * 1000 - 3600000
    LOOP EXECUTE format('DROP SCHEMA %I CASCADE', s); END LOOP; END $$;`);
  prismaCli(["migrate", "deploy"], env); // the same migrations the app runs, into this run's own schema

  const log = path.join(tmp, "api.log");
  const out = fs.openSync(log, "a");
  const child = spawn(process.execPath, ["src/index.ts"], { cwd: SERVER_DIR, env, stdio: ["ignore", out, out] });
  const apiUrl = `http://127.0.0.1:${apiPort}`;

  const stop = async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
    fs.closeSync(out);
    ai.server.close();
    n8n.server.close();
    books.server.close();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    try {
      prismaCli(["db", "execute", "--url", TEST_DB, "--stdin"], env, `DROP SCHEMA IF EXISTS "${schema}" CASCADE; DROP SCHEMA IF EXISTS "${schema}_jobs" CASCADE;`);
    } catch { /* already gone */ }
  };
  try {
    await waitForHealth(apiUrl, child, log);
  } catch (e) {
    await stop(); // otherwise the fake servers keep the test run from exiting
    throw e;
  }
  return { apiUrl, aiUrl: ai.url, n8nUrl: n8n.url, tmpDir: tmp, databaseUrl: env.DATABASE_URL, stop };
}

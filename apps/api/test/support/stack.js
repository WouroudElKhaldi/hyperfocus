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
  const dbFile = path.join(tmp, "test.db");
  const [ai, n8n, books, apiPort] = await Promise.all([startFakeAi(), startFakeN8n(), startFakeBooks(), port ?? freePort()]);

  const env = {
    ...process.env,
    DATABASE_URL: `file:${dbFile.replace(/\\/g, "/")}`,
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

  execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { cwd: DB_DIR, env, stdio: "pipe" });
  if (!fs.existsSync(dbFile)) throw new Error("The test database was not created where expected; refusing to run against another database.");

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
  };
  try {
    await waitForHealth(apiUrl, child, log);
  } catch (e) {
    await stop(); // otherwise the fake servers keep the test run from exiting
    throw e;
  }
  return { apiUrl, aiUrl: ai.url, n8nUrl: n8n.url, tmpDir: tmp, stop };
}

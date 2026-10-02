import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { freePort } from "../support/stack.js";
import { ok, post } from "../support/api.js";

// P4-05: with two copies of the API on the same database (as when it is hosted), each background job still runs once:
// a reminder is never sent twice. A second API is started next to the test stack's one, on the same database.

const SERVER_DIR = fileURLToPath(new URL("../../", import.meta.url));
let second, secondLog, secondUrl;

beforeAll(async () => {
  const tmp = inject("tmpDir");
  secondLog = path.join(tmp, "api-2.log");
  const port = await freePort();
  secondUrl = `http://127.0.0.1:${port}`;
  const out = fs.openSync(secondLog, "a");
  second = spawn(process.execPath, ["src/index.ts"], {
    cwd: SERVER_DIR,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      DATABASE_URL: inject("databaseUrl"),
      PORT: String(port),
      NOTIFY_DRY_RUN: "1",
      SETTINGS_FILE: path.join(tmp, "settings.json"),
      BACKUP_DIR: path.join(tmp, "backups"),
      N8N_WEBHOOK_URL: `${inject("n8nUrl")}/webhook`,
      DEEPSEEK_API_KEY: "test-key",
      GMAIL_USER: " ",
      GMAIL_APP_KEY: " ",
      RATE_LIMIT_PER_MINUTE: "1000000",
      AI_RATE_LIMIT_PER_MINUTE: "1000000",
    },
  });
  for (const end = Date.now() + 60000; Date.now() < end; ) {
    try { if ((await fetch(`${secondUrl}/api/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`The second API did not start:\n${fs.readFileSync(secondLog, "utf8")}`);
}, 70000);

afterAll(async () => {
  if (second && second.exitCode === null) {
    second.kill();
    await new Promise((r) => second.once("exit", r));
  }
});

// how many times a reminder's notification went out, counting both APIs' logs (notifications are dry-run lines)
const sent = (title) =>
  [path.join(inject("tmpDir"), "api.log"), secondLog].map((f) => (fs.readFileSync(f, "utf8").match(new RegExp(`⏰ ${title}\\b`, "g")) ?? []).length).reduce((a, b) => a + b, 0);

describe("two copies of the API on one database", { timeout: 90000 }, () => {
  it("both answer, from the same data", async () => {
    const r = await ok(post("/api/reminders", { title: "seen by both", at: new Date(Date.now() + 86400000).toISOString() }));
    const list = await (await fetch(`${secondUrl}/api/reminders`)).json();
    expect(list.some((x) => x.id === r.id)).toBe(true);
  });

  it("runs each background job once per interval in all, not once per copy", async () => {
    // the queue's own records (pg-boss, in this run's "<schema>_jobs" schema): runs of the 20-second reminder job
    const { PrismaClient } = await import("@hyperfocus/db");
    const db = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
    const jobs = `${new URL(inject("databaseUrl")).searchParams.get("schema")}_jobs`;
    const count = async () => (await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${jobs}".job WHERE name = 'my-reminders'`))[0].n;
    const before = await count();
    await new Promise((r) => setTimeout(r, 62000)); // three 20-second intervals, both copies running
    const runs = (await count()) - before;
    await db.$disconnect();
    expect(runs).toBeGreaterThanOrEqual(2); // it keeps running…
    expect(runs).toBeLessThanOrEqual(4); // …but not 6 (3 intervals × 2 copies)
  });

  it("sends each due reminder exactly once", async () => {
    const titles = ["twin-a", "twin-b", "twin-c"];
    for (const title of titles) await ok(post("/api/reminders", { title, at: new Date(Date.now() - 60000).toISOString() }));
    for (const end = Date.now() + 60000; Date.now() < end && titles.some((t) => sent(t) === 0); ) await new Promise((r) => setTimeout(r, 500));
    await new Promise((r) => setTimeout(r, 25000)); // one more round of the job on both copies: nothing may go out again
    for (const t of titles) expect(sent(t), `notifications for ${t}`).toBe(1);
  });
});

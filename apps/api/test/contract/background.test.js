import fs from "node:fs";
import { PrismaClient } from "@hyperfocus/db";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { freePort } from "../support/stack.js";
import { fake, get, ok, patch, post } from "../support/api.js";

// The API runs timers in the background: "my reminders" every 20s and the LinkedIn post scheduler every 30s.
// These tests wait for those real timers. Times are moved into the past directly in the test database,
// because the API (correctly) refuses to schedule anything in the past.

let db;
beforeAll(() => { db = new PrismaClient({ datasourceUrl: inject("databaseUrl") }); }); // this run's own test schema
afterAll(() => db?.$disconnect());

// (through Prisma, like the app: a raw UPDATE would send the date in this computer's time zone)
const setTime = (model, column, id, date) => db[model].update({ where: { id }, data: { [column]: date } });

async function until(check, ms = 45000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out waiting for the background job");
    await new Promise((r) => setTimeout(r, 500));
  }
}

describe("background jobs", { timeout: 60000 }, () => {
  it("fires due reminders: one-offs finish, repeating ones move to their next time", async () => {
    const once = await ok(post("/api/reminders", { title: "bg once", at: new Date(Date.now() - 60000).toISOString() }));
    const daily = await ok(post("/api/reminders", { title: "bg daily", at: new Date(Date.now() - 60000).toISOString(), repeat: "daily" }));
    const fired = await until(async () => {
      const list = await ok(get("/api/reminders"));
      const a = list.find((r) => r.id === once.id), b = list.find((r) => r.id === daily.id);
      return a?.done && b?.lastFiredAt ? { a, b } : null;
    });
    expect(fired.a.lastFiredAt).not.toBeNull();
    expect(fired.b.done).toBe(false);
    expect(new Date(fired.b.at).getTime()).toBeGreaterThan(Date.now());
  });

  it("auto-posts a scheduled post that is due, and marks one that is long overdue as missed", async () => {
    await fake.reset("n8n");
    const make = async (draft) => {
      const p = await ok(post("/api/posts", { thought: "t" }));
      await ok(patch(`/api/posts/${p.id}`, { draft }));
      return ok(post(`/api/posts/${p.id}/schedule`, { scheduledAt: new Date(Date.now() + 120000).toISOString() }));
    };
    const due = await make("Scheduled hello");
    const old = await make("Too late");
    await setTime("post", "scheduledAt", due.id, new Date(Date.now() - 1000));
    await setTime("post", "scheduledAt", old.id, new Date(Date.now() - 3 * 3600000));

    const done = await until(async () => {
      const [a, b] = await Promise.all([ok(get(`/api/posts/${due.id}`)), ok(get(`/api/posts/${old.id}`))]);
      return a.status === "posted" && b.status === "missed" ? { a, b } : null;
    });
    expect(done.a.postedAt).not.toBeNull();
    expect(done.b.lastError).toMatch(/wasn't running/);
    const sent = (await fake.requests("n8n")).map((r) => r.body);
    expect(sent).toContainEqual({ postId: due.id, text: "Scheduled hello" });
    expect(sent.some((b) => b.postId === old.id)).toBe(false); // a missed post is never sent
  });

  // P2-21: the automatic backup is a background job too; with no backup yet, it makes one right away. Checked on an API with a
  // database (and so a job queue) and a backups folder of its own: the shared API's queue rightly runs the daily backup only
  // once for every copy, and another test may already have made a backup there.
  it("makes the automatic backup at start-up", async () => {
    const url = new URL(inject("databaseUrl"));
    const schema = `${url.searchParams.get("schema")}_startup`;
    url.searchParams.set("schema", schema);
    const dbDir = fileURLToPath(new URL("../../../../packages/db/", import.meta.url));
    const prismaCli = (args, input) => execFileSync(process.execPath, [path.join(dbDir, "node_modules/prisma/build/index.js"), ...args], { cwd: dbDir, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", ...(input ? { input } : {}) });
    prismaCli(["migrate", "deploy"]);
    const dir = path.join(inject("tmpDir"), "backups-startup");
    const log = path.join(inject("tmpDir"), "api-startup.log");
    const port = await freePort();
    const out = fs.openSync(log, "a");
    const child = spawn(process.execPath, ["src/index.ts"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)), stdio: ["ignore", out, out],
      env: { ...process.env, DATABASE_URL: url.toString(), PORT: String(port), NOTIFY_DRY_RUN: "1", BACKUP_DIR: dir,
        SETTINGS_FILE: path.join(inject("tmpDir"), "settings-startup.json"), GMAIL_USER: " ", GMAIL_APP_KEY: " ", DEEPSEEK_API_KEY: "test-key" },
    });
    try {
      const line = await until(() => fs.readFileSync(log, "utf8").match(/Automatic backup: (thought-studio-[\d_-]+\.dump)/));
      expect(fs.readdirSync(dir)).toContain(line[1]);
    } finally {
      child.kill();
      await new Promise((r) => child.once("exit", r));
      try { prismaCli(["db", "execute", "--url", url.toString(), "--stdin"], `DROP SCHEMA IF EXISTS "${schema}" CASCADE; DROP SCHEMA IF EXISTS "${schema}_jobs" CASCADE;`); } catch { /* gone */ }
    }
  }, 90000);
});

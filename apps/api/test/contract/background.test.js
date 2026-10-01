import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { fake, get, ok, patch, post } from "../support/api.js";

// The API runs timers in the background: "my reminders" every 20s and the LinkedIn post scheduler every 30s.
// These tests wait for those real timers. Times are moved into the past directly in the test database,
// because the API (correctly) refuses to schedule anything in the past.

let db;
beforeAll(() => { db = new DatabaseSync(path.join(inject("tmpDir"), "test.db")); });
afterAll(() => db?.close());

const setTime = (table, column, id, date) => db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(date.getTime(), id);

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
    setTime("Post", "scheduledAt", due.id, new Date(Date.now() - 1000));
    setTime("Post", "scheduledAt", old.id, new Date(Date.now() - 3 * 3600000));

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
});

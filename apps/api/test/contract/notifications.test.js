import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { deliverTo } from "../../src/notifications.ts";
import { deliverOutbox, enqueue } from "../../src/outbox.ts";
import { asSystem, asUser, tenancy } from "../../src/tenancy.ts";
import { get, ok, patch, post } from "../support/api.js";

// P5-11: notifications land in the bell (in-app), always; outside quiet hours they also pop up on the channels you
// switched on (here the desktop pop-up, written to the test API's log). Delivery reaches the person each one is for.

const popups = () => fs.readFileSync(path.join(inject("tmpDir"), "api.log"), "utf8").split("\n").filter((l) => l.includes("[notify dry-run]")).length;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("the bell", () => {
  afterAll(() => patch("/api/settings", { quietFrom: "", quietTo: "", desktop: true }));

  it("a test notification lands in the bell, unread, and pops up", async () => {
    const before = popups();
    await ok(post("/api/notify/test", {}));
    const inbox = await ok(get("/api/notifications"));
    expect(inbox.items[0]).toMatchObject({ title: "💜 Hyperfocus", read: false });
    expect(inbox.unread).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 300));
    expect(popups()).toBe(before + 1);
    expect(await ok(post("/api/notifications/read", {}))).toEqual({ unread: 0 });
    expect((await ok(get("/api/notifications"))).items[0].read).toBe(true);
  });

  it("in quiet hours (on your own clock) nothing pops up, but it is still in the bell", async () => {
    const now = new Date();
    await ok(patch("/api/settings", { timeZone: tz, quietFrom: hhmm(new Date(now.getTime() - 3600000)), quietTo: hhmm(new Date(now.getTime() + 3600000)) }));
    const before = popups();
    await ok(post("/api/notify/test", {}));
    await new Promise((r) => setTimeout(r, 300));
    expect(popups()).toBe(before);
    expect((await ok(get("/api/notifications"))).unread).toBe(1);
    // pop-ups switched off: same
    await ok(patch("/api/settings", { quietFrom: "", quietTo: "", desktop: false }));
    await ok(post("/api/notify/test", {}));
    await new Promise((r) => setTimeout(r, 300));
    expect(popups()).toBe(before);
    expect((await ok(get("/api/notifications"))).unread).toBe(2);
    await ok(post("/api/notifications/read", {}));
  });

  it("checks quiet hours and the time zone it is given", async () => {
    const s = await ok(patch("/api/settings", { quietFrom: "25:00", timeZone: "Mars/Base" }));
    expect(s.quietFrom).not.toBe("25:00");
    expect(s.timeZone).not.toBe("Mars/Base");
  });
});

describe("delivery", () => {
  let raw, db;
  const other = `notif-other-${Date.now()}`;
  beforeAll(async () => {
    raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
    db = raw.$extends(tenancy);
    await raw.user.create({ data: { id: other, name: "Other", email: `${other}@example.com` } });
  });
  afterAll(async () => {
    await raw.user.delete({ where: { id: other } });
    await raw.$disconnect();
  });

  it("each message reaches the person it is for, once, even when sent again", async () => {
    await asUser(other, () => enqueue(db, "n1:hello", "For Other", "", "test-n"));
    const desktop = [];
    const send = deliverTo(db, { desktop: async (n) => { desktop.push(n.userId); return { ok: true }; } });
    await asSystem(() => deliverOutbox(db, send, { kind: "test-n" }));
    await send({ userId: other, key: "n1:hello", title: "For Other", body: "" }); // (a retry)
    const notes = await raw.notification.findMany({ where: { key: "n1:hello" } });
    expect(notes.map((n) => [n.userId, n.title])).toEqual([[other, "For Other"]]);
    expect(desktop[0]).toBe(other);
    // and the owner's bell doesn't show it
    expect(JSON.stringify(await ok(get("/api/notifications")))).not.toContain("For Other");
  });
});

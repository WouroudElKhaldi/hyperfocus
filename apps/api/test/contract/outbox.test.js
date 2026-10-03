import { afterAll, beforeAll, beforeEach, describe, expect, inject, it as vitestIt } from "vitest";
import { PrismaClient } from "@hyperfocus/db";
import { deliverOutbox, enqueue, MAX_ATTEMPTS } from "../../src/outbox.ts";
import { asUser, tenancy } from "../../src/tenancy.ts";
import { ok, post } from "../support/api.js";

// P4-06: the transactional outbox. No notification is lost (a failed send is kept and retried) and none is sent twice
// (unique keys, and each send is claimed first). Run against this test run's own database schema.

// these messages have their own kind, so the app's own delivery job (which sends notifications) leaves them to the test
const K = "test";
// (each message belongs to someone, P5-11: the tests write and deliver as the owner)
let raw, db;
beforeAll(() => { raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") }); db = raw.$extends(tenancy); });
afterAll(() => raw?.$disconnect());
beforeEach(() => raw.outboxMessage.deleteMany({ where: { kind: K } })); // each test starts with an empty test outbox
const it = (name, fn, timeout) => vitestIt(name, () => asUser("owner", fn), timeout);

// a fake "send" that records what went out, and can be told to fail
const sender = (failures = 0) => {
  const out = [];
  let left = failures;
  const send = async (title, body) => {
    if (left > 0) { left--; return { ok: false, error: "offline" }; }
    out.push(`${title}|${body}`);
    return { ok: true };
  };
  return { send, out };
};
const row = (key) => db.outboxMessage.findFirst({ where: { key } });
const mine = (key) => ({ where: { key: { startsWith: key } } });

describe("the outbox", () => {
  it("keeps one message per key, however often it is written", async () => {
    await enqueue(db, "t1:once", "Hello", "a", K);
    await enqueue(db, "t1:once", "Hello", "a", K);
    await Promise.all([enqueue(db, "t1:once", "Hello", "a", K), enqueue(db, "t1:once", "Hello", "a", K)]);
    expect(await db.outboxMessage.count({ where: { key: "t1:once" } })).toBe(1);
  });

  it("keeps a message that failed and sends it on a later try; once sent, never again", async () => {
    await enqueue(db, "t2:retry", "Retry me", "b", K);
    const s = sender(1);
    await deliverOutbox(db, s.send, { kind: K });
    expect(await row("t2:retry")).toMatchObject({ sentAt: null, attempts: 1, lastError: "offline" }); // not lost
    await deliverOutbox(db, s.send, { kind: K });
    expect((await row("t2:retry")).sentAt).not.toBeNull();
    await deliverOutbox(db, s.send, { kind: K });
    expect(s.out.filter((x) => x.startsWith("Retry me"))).toHaveLength(1); // not repeated
  });

  it(`stops trying after ${MAX_ATTEMPTS} failures (and says why)`, async () => {
    await enqueue(db, "t3:give-up", "Never works", "c", K);
    const s = sender(99);
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await deliverOutbox(db, s.send, { kind: K });
    expect(await row("t3:give-up")).toMatchObject({ sentAt: null, attempts: MAX_ATTEMPTS, lastError: "offline" });
  });

  it("sends each message once even when two copies deliver at the same moment", async () => {
    for (let i = 0; i < 10; i++) await enqueue(db, `t4:pair:${i}`, `Pair ${i}`, "d", K);
    const s = sender(0);
    await Promise.all([deliverOutbox(db, s.send, { kind: K, limit: 50 }), deliverOutbox(db, s.send, { kind: K, limit: 50 }), deliverOutbox(db, s.send, { kind: K, limit: 50 })]);
    for (let i = 0; i < 10; i++) expect(s.out.filter((x) => x === `Pair ${i}|d`), `Pair ${i}`).toHaveLength(1);
    expect(await db.outboxMessage.count({ where: { ...mine("t4:pair").where, sentAt: null } })).toBe(0);
  });

  vitestIt("each person has their own messages: the same key for two people is two messages (P5-11)", async () => {
    const other = `outbox-other-${Date.now()}`;
    await raw.user.create({ data: { id: other, name: "Other", email: `${other}@example.com` } });
    try {
      await asUser("owner", () => enqueue(db, "t5:morning", "Owner's morning", "", K));
      await asUser(other, () => enqueue(db, "t5:morning", "Other's morning", "", K));
      const rows = await raw.outboxMessage.findMany({ where: { key: "t5:morning" }, orderBy: { id: "asc" } });
      expect(rows.map((r) => [r.userId, r.title])).toEqual([["owner", "Owner's morning"], [other, "Other's morning"]]);
      // and a person only ever sees their own
      expect((await asUser(other, async () => await db.outboxMessage.findMany({ where: { key: "t5:morning" } }))).map((r) => r.title)).toEqual(["Other's morning"]);
    } finally {
      await raw.user.delete({ where: { id: other } });
    }
  });

  it("a due reminder is finished and its notification queued together, then delivered", async () => {
    const r = await ok(post("/api/reminders", { title: "outbox reminder", at: new Date(Date.now() - 60000).toISOString() }));
    let msg;
    for (const end = Date.now() + 45000; Date.now() < end && !msg?.sentAt; ) {
      await new Promise((res) => setTimeout(res, 500));
      msg = await db.outboxMessage.findFirst({ where: { key: { startsWith: `reminder:${r.id}:` } } });
    }
    expect(msg).toMatchObject({ title: "⏰ outbox reminder", attempts: 1, lastError: "" });
    expect(msg.sentAt).not.toBeNull();
    expect((await db.reminder.findUnique({ where: { id: r.id } })).done).toBe(true); // finished in the same transaction
  }, 60000);
});

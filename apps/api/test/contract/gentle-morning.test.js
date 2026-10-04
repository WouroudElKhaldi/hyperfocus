import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { saveSettings } from "../../src/notify.ts";
import { checkReminders, gentleWaiting } from "../../src/reminders.ts";
import { asUser, tenancy } from "../../src/tenancy.ts";

// P3-25 (interview 1): what is still waiting from earlier days is said plainly and kindly in the morning message.

const who = `gentle-${Date.now()}`;
let raw, db;
const as = (fn) => asUser(who, async () => await fn());
const morning = () => raw.outboxMessage.findFirst({ where: { userId: who, key: { startsWith: "morning:" } } });
const NOON = new Date("2026-10-05T12:00:00Z");

beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  db = new PrismaClient({ datasourceUrl: inject("databaseUrl"), omit: OWNER_OMIT }).$extends(tenancy);
  await raw.user.create({ data: { id: who, name: "Gentle", email: `${who}@example.com` } });
  await as(() => saveSettings(db, { timeZone: "UTC", morningAt: "08:00" }));
});
afterAll(async () => {
  await raw.user.deleteMany({ where: { id: who } });
  await raw.$disconnect();
  await db.$disconnect();
});

describe("gentle facts in the morning", () => {
  it("the words: the number, no blame, a kind way forward", () => {
    expect(gentleWaiting(1)).toBe("1 task is still waiting from earlier days. That happens. Pick one for today, or give it a new day: both are fine.");
    expect(gentleWaiting(3)).toMatch(/^3 tasks are still waiting/);
    for (const n of [1, 3]) expect(gentleWaiting(n)).not.toMatch(/overdue|behind|failed|should|missed/i);
  });

  it("nothing for today but 2 waiting from before: a fresh-day message with the facts", async () => {
    await as(() => db.task.createMany({ data: [{ title: "Old one", dueDay: "2026-10-01" }, { title: "Old two", dueDay: "2026-10-03" }] }));
    await as(() => checkReminders(db, NOON));
    expect(await morning()).toMatchObject({ title: "🌸 A fresh day", body: gentleWaiting(2) });
  });

  it("with something for today: start with it, then the waiting ones, once a day", async () => {
    await raw.outboxMessage.deleteMany({ where: { userId: who } });
    await as(() => db.task.create({ data: { title: "Call the dentist", today: true } }));
    await as(() => checkReminders(db, NOON));
    await as(() => checkReminders(db, NOON));
    const m = await morning();
    expect(m.title).toBe("🌸 Today: 1 thing");
    expect(m.body).toBe(`Start with: Call the dentist. Just that one.\n${gentleWaiting(2)}`);
    expect(await raw.outboxMessage.count({ where: { userId: who, key: { startsWith: "morning:" } } })).toBe(1);
  });
});

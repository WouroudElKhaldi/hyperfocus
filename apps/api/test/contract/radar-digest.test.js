import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import { saveSettings } from "../../src/notify.ts";
import { queueRadarDigest } from "../../src/radar/digest.ts";
import { processBatch, receiveBatch } from "../../src/radar/ingest.ts";
import { backfillFilter } from "../../src/radar/matcher.ts";
import { asUser, tenancy } from "../../src/tenancy.ts";

// P6-24: telling someone about their new matches, as each filter asks (daily top 5, weekly, as they come, off).
// One person of their own, on UTC with mornings at 08:00.

const stamp = Date.now();
const who = `radar-digest-${stamp}`;
let raw, db, source;
const KINDS = ["Backend", "Frontend", "Platform", "Mobile", "Payments", "Cloud", "Security"];
const item = (n) => ({
  slug: `dg-${n}-${stamp}`, company_name: `Company ${KINDS[n - 1]}`, title: `${KINDS[n - 1]} Software Engineer ${stamp}`, description: "<p>Python.</p>", remote: true,
  url: `https://jobs.example/dg-${n}-${stamp}`, tags: [], job_types: ["full time"], location: "Remote", created_at: Math.floor(Date.now() / 1000) - 3600,
});
const as = (fn) => asUser(who, async () => await fn());
const filterFor = (digest) => as(async () => {
  const f = await db.jobFilter.create({ data: { name: `F ${digest}`, spec: { titles: [`Software Engineer`], keywords: { include: [String(stamp)], exclude: [], scope: ["title"] }, digest } } });
  await backfillFilter(db, f.id);
  return f;
});
const messages = () => raw.outboxMessage.findMany({ where: { userId: who }, orderBy: { id: "asc" } });
const told = () => raw.jobMatch.count({ where: { userId: who, notifiedAt: { not: null } } });
const clear = async () => {
  await raw.outboxMessage.deleteMany({ where: { userId: who } });
  await raw.jobFilter.deleteMany({ where: { userId: who } });
};
// 2026-10-05 is a Monday
const MONDAY_7 = new Date("2026-10-05T07:00:00Z");
const MONDAY_9 = new Date("2026-10-05T09:00:00Z");
const TUESDAY_9 = new Date("2026-10-06T09:00:00Z");

beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  db = new PrismaClient({ datasourceUrl: inject("databaseUrl"), omit: OWNER_OMIT }).$extends(tenancy);
  source = await raw.jobSource.create({ data: { key: `test-digest-${stamp}`, kind: "arbeitnow", name: "Arbeitnow (test)" } });
  await raw.user.create({ data: { id: who, name: "Digest", email: `${who}@example.com` } });
  await as(() => saveSettings(db, { timeZone: "UTC", morningAt: "08:00" }));
  const b = await receiveBatch(db, source, [1, 2, 3, 4, 5, 6, 7].map(item), `dg-${stamp}`);
  await processBatch(db, b.batchId);
});
afterAll(async () => {
  await raw.user.deleteMany({ where: { id: who } });
  await raw.jobSource.deleteMany({ where: { key: `test-digest-${stamp}` } });
  await raw.$disconnect();
  await db.$disconnect();
});

describe("match digest", () => {
  afterEach(clear);

  it("daily: nothing before the morning, then one message with the top 5; the rest wait for the next day", async () => {
    await filterFor("daily");
    expect(await as(() => queueRadarDigest(db, MONDAY_7))).toBe(0);
    expect(await as(() => queueRadarDigest(db, MONDAY_9))).toBe(1);
    const [m] = await messages();
    expect(m.title).toMatch(/^📡 5 new jobs for you \(F daily\)$/);
    expect(m.body.split("\n")).toHaveLength(5);
    expect(await told()).toBe(5);
    expect(await as(() => queueRadarDigest(db, MONDAY_9))).toBe(0); // once a day: the other 2 are not marked
    expect(await told()).toBe(5);
    expect(await as(() => queueRadarDigest(db, TUESDAY_9))).toBe(1);
    expect((await messages())[1].title).toMatch(/^📡 2 new jobs/);
    expect(await told()).toBe(7);
  });

  it("weekly: only on Monday mornings", async () => {
    await filterFor("weekly");
    expect(await as(() => queueRadarDigest(db, TUESDAY_9))).toBe(0);
    expect(await as(() => queueRadarDigest(db, MONDAY_9))).toBe(1);
  });

  it("as they come: one message each, never more than 5 a day", async () => {
    await filterFor("realtime");
    expect(await as(() => queueRadarDigest(db, MONDAY_7))).toBe(5); // morning or not
    expect(await as(() => queueRadarDigest(db, MONDAY_9))).toBe(0); // 5 already today
    const all = await messages();
    expect(all).toHaveLength(5);
    expect(all[0].title).toMatch(/^📡 A new job for you: \w+ Software Engineer/);
    expect(await as(() => queueRadarDigest(db, TUESDAY_9))).toBe(2);
  });

  it("off: nothing at all", async () => {
    await filterFor("off");
    expect(await as(() => queueRadarDigest(db, MONDAY_9))).toBe(0);
    expect(await messages()).toHaveLength(0);
  });
});

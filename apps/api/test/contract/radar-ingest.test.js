import fs from "node:fs";
import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { signIngest } from "../../src/modules/radar/ingest-routes.ts";
import { fetchDue } from "../../src/radar/fetch.ts";
import { placeOf, processBatch, receiveBatch, titleSimilarity } from "../../src/radar/ingest.ts";
import { applyPostingRetention } from "../../src/radar/retention.ts";
import { post } from "../support/api.js";
import { startExtraApi } from "../support/extra-api.js";

// P6-11, P6-13, P6-17: the ingestion pipeline on the answers recorded from the real sources, in this run's database.

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`../fixtures/sources/${name}.json`, import.meta.url), "utf8"));
const stamp = Date.now();
let db, source, other;
beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  source = await db.jobSource.create({ data: { key: `test-arbeitnow-${stamp}`, kind: "arbeitnow", name: "Arbeitnow (test)" } });
  other = await db.jobSource.create({ data: { key: `test-arbeitnow-b-${stamp}`, kind: "arbeitnow", name: "Another (test)" } });
});
afterAll(async () => {
  await db.jobSource.deleteMany({ where: { key: { contains: String(stamp) } } });
  await db.$disconnect();
});
const items = () => fixture("arbeitnow").data;
// (the test API's own "radar-ingest" job may claim a queued batch first: only one copy processes it, so then its
// counts are read from the finished batch)
const run = async (src, list, key) => {
  const r = await receiveBatch(db, src, list, key);
  if (r.replay) return { ...r, result: null };
  const mine = await processBatch(db, r.batchId);
  if (mine) return { ...r, result: mine };
  for (const end = Date.now() + 15000; Date.now() < end; ) {
    const b = await db.ingestBatch.findUnique({ where: { id: r.batchId } });
    if (b.status === "done") return { ...r, result: { received: b.received, created: b.created, updated: b.updated, duplicates: b.duplicates, failed: b.failed } };
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error("the batch was never processed");
};

describe("the ingestion pipeline", () => {
  it("stores new postings, normalised and classified; the same batch again is a replay; the same items again change nothing", async () => {
    const first = await run(source, items(), `k1-${stamp}`);
    expect(first.result).toMatchObject({ received: 4, created: 4, updated: 0, failed: 0 });
    const stored = await db.jobPosting.findMany({ where: { sourceId: source.id }, orderBy: { id: "asc" } });
    expect(stored.find((p) => p.title === "Management Accountant")).toMatchObject({ company: "Black Forest Labs", workMode: "onsite", employmentType: "full_time", salaryMin: 70000, salaryCurrency: "EUR", duplicateOfId: null });
    expect(stored[0].expiresAt.getTime() - stored[0].postedAt.getTime()).toBe(45 * 24 * 3600_000); // kept 45 days
    expect(stored.every((p) => !/<[a-z]/i.test(p.description))).toBe(true);

    expect((await run(source, items(), `k1-${stamp}`)).replay).toBe(true);
    expect((await run(source, items(), `k2-${stamp}`)).result).toMatchObject({ created: 0, updated: 0, duplicates: 0 });
    const changed = items();
    changed[0].description += "<p>Now with a bonus.</p>";
    expect((await run(source, changed, `k3-${stamp}`)).result).toMatchObject({ created: 0, updated: 1 });
    expect(await db.ingestBatch.findFirst({ where: { idempotencyKey: `k3-${stamp}` } })).toMatchObject({ status: "done", updated: 1, items: [] });
  });

  it("spots duplicates: the same posting from another source, or the same job with the title written differently", async () => {
    const same = await run(other, [items()[2]], `d1-${stamp}`);
    expect(same.result).toMatchObject({ created: 1, duplicates: 1 });
    const copy = await db.jobPosting.findFirst({ where: { sourceId: other.id } });
    const original = await db.jobPosting.findFirst({ where: { sourceId: source.id, title: "Management Accountant" } });
    expect(copy.duplicateOfId).toBe(original.id);

    const variant = { ...items()[1], slug: `variant-${stamp}`, title: "Project Manager – Software Implementation", location: "Remote" };
    expect((await run(other, [variant], `d2-${stamp}`)).result).toMatchObject({ created: 1, duplicates: 1 });
    const different = { ...items()[2], slug: `senior-${stamp}`, title: "Senior Management Accountant" };
    expect((await run(other, [different], `d3-${stamp}`)).result).toMatchObject({ created: 1, duplicates: 0 });
  });

  it("keeps going past an item it can't read, and says which", async () => {
    const r = await run(source, [{ slug: "broken" }, { ...items()[0], slug: `fine-${stamp}` }], `e1-${stamp}`);
    expect(r.result).toMatchObject({ created: 1, failed: 1 });
    const batch = await db.ingestBatch.findFirst({ where: { idempotencyKey: `e1-${stamp}` } });
    expect(batch.errors[0]).toMatchObject({ index: 0, message: expect.any(String) });
  });

  it("titles and places", () => {
    expect(titleSimilarity("Project Manager - Software Implementation (m/f/x)", "Project Manager – Software Implementation")).toBe(1);
    expect(titleSimilarity("Management Accountant", "Senior Management Accountant")).toBeLessThan(0.8);
    const places = { countries: new Map([["germany", "DE"], ["lebanon", "LB"], ["france", "FR"]]), cities: new Map([["beirut", { id: 1, country: "LB" }], ["freiburg", { id: 2, country: "DE" }], ["paris", { id: 3, country: "FR" }]]) };
    expect(placeOf("Freiburg (Germany)", places, null)).toEqual({ countryCode: "DE", cityId: 2 });
    expect(placeOf("Remote, France", places, null)).toEqual({ countryCode: "FR", cityId: null });
    expect(placeOf("Beirut", places, null)).toEqual({ countryCode: "LB", cityId: 1 });
    expect(placeOf("London; Stockholm", places, "GB")).toEqual({ countryCode: "GB", cityId: null });
  });
});

describe("fetching from a source", () => {
  it("asks no more often than allowed, follows pages, and the same answer adds nothing", async () => {
    const fetchSource = await db.jobSource.create({ data: { key: `test-fetch-${stamp}`, kind: "arbeitnow", name: "Fetch (test)" } });
    await db.jobSource.updateMany({ where: { id: { not: fetchSource.id } }, data: { enabled: false } }); // (only this one)
    const asked = [];
    const http = async (url) => { asked.push(url); return url.includes("page=2") ? { data: [], links: {} } : fixture("arbeitnow"); };
    const t0 = new Date();
    const r1 = await fetchDue(db, { now: t0, http });
    expect(r1).toEqual([{ source: fetchSource.key, pages: 2, items: 4, created: expect.any(Number) }]);
    expect(asked).toHaveLength(2);
    expect(await fetchDue(db, { now: new Date(t0.getTime() + 30 * 60_000), http })).toEqual([]); // too soon (every 2 h)
    const r3 = await fetchDue(db, { now: new Date(t0.getTime() + 3 * 3600_000), http });
    expect(r3[0]).toMatchObject({ created: 0 }); // the same answer: nothing new
    const failing = await fetchDue(db, { now: new Date(t0.getTime() + 6 * 3600_000), http: async () => { throw new Error("arbeitnow answered 503"); } });
    expect(failing[0].error).toBe("arbeitnow answered 503");
    expect((await db.jobSource.findUnique({ where: { id: fetchSource.id } })).lastError).toBe("arbeitnow answered 503");
    await db.jobSource.updateMany({ data: { enabled: true } });
  });
});

describe("retention", () => {
  it("archives postings past their date (text deleted), and deletes old archived ones nobody saved", async () => {
    const p = await db.jobPosting.findFirst({ where: { sourceId: source.id, title: "Senior Partner" } });
    await db.jobPosting.update({ where: { id: p.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await applyPostingRetention(db);
    expect(r.archived).toBeGreaterThanOrEqual(1);
    expect(await db.jobPosting.findUnique({ where: { id: p.id } })).toMatchObject({ description: "", raw: {}, archivedAt: expect.any(Date), title: "Senior Partner" });
    await db.jobPosting.update({ where: { id: p.id }, data: { archivedAt: new Date(Date.now() - 100 * 24 * 3600_000) } });
    expect((await applyPostingRetention(db)).deleted).toBeGreaterThanOrEqual(1);
    expect(await db.jobPosting.findUnique({ where: { id: p.id } })).toBeNull();
  });
});

describe("the ingest endpoint", () => {
  let api;
  const SECRET = "test-ingest-secret-that-is-long-enough-123";
  beforeAll(async () => {
    api = await startExtraApi("radar_ingest", { INGEST_SECRET: SECRET });
    const d = new PrismaClient({ datasourceUrl: api.dbUrl });
    await d.jobSource.create({ data: { key: "arbeitnow", kind: "arbeitnow", name: "Arbeitnow" } });
    await d.$disconnect();
  }, 120000);
  afterAll(async () => { await api?.stop(); });
  const send = (body, { secret = SECRET, ts = String(Math.floor(Date.now() / 1000)), key = "batch-1", sig } = {}) => {
    const text = JSON.stringify(body);
    return fetch(`${api.url}/api/ingest/jobs`, { method: "POST", headers: { "Content-Type": "application/json", "X-Timestamp": ts, "X-Idempotency-Key": key, "X-Signature": sig ?? signIngest(secret, ts, text) }, body: text });
  };

  it("is off without a secret", async () => {
    expect((await post("/api/ingest/jobs", { source: "arbeitnow", items: [] })).status).toBe(404);
  });

  it("refuses what isn't signed right, is too old, or names no source", async () => {
    expect((await send({ source: "arbeitnow", items: [] }, { secret: "someone-else-entirely-wrong-secret-0000" })).status).toBe(401);
    expect((await send({ source: "arbeitnow", items: [] }, { sig: "sha256=00" })).status).toBe(401);
    expect((await send({ source: "arbeitnow", items: [] }, { ts: String(Math.floor(Date.now() / 1000) - 3600) })).status).toBe(401);
    expect((await send({ source: "nowhere", items: [] }, { key: "x1" })).status).toBe(400);
    expect((await send({ source: "arbeitnow", items: Array(501).fill({}) }, { key: "x2" })).status).toBe(400);
  });

  it("queues a signed batch (202), processes it, and a replay creates nothing", async () => {
    const r = await send({ source: "arbeitnow", items: fixture("arbeitnow").data });
    expect(r.status).toBe(202);
    expect(await r.json()).toMatchObject({ replay: false, status: "queued" });
    const d = new PrismaClient({ datasourceUrl: api.dbUrl });
    try {
      let batch;
      for (const end = Date.now() + 15000; Date.now() < end && batch?.status !== "done"; ) {
        batch = await d.ingestBatch.findFirst({ where: { idempotencyKey: "batch-1" } });
        await new Promise((res) => setTimeout(res, 200));
      }
      expect(batch).toMatchObject({ status: "done", created: 4 });
      const again = await send({ source: "arbeitnow", items: fixture("arbeitnow").data });
      expect(await again.json()).toMatchObject({ replay: true });
      expect(await d.jobPosting.count()).toBe(4);
    } finally {
      await d.$disconnect();
    }
  });
});

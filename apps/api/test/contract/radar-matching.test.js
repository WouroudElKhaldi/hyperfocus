import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { backfillFilter, matchNewPostings } from "../../src/radar/matcher.ts";
import { processBatch, receiveBatch } from "../../src/radar/ingest.ts";
import { asUser, tenancy } from "../../src/tenancy.ts";
import { del, get, ok, patch, post } from "../support/api.js";

// P6-23, P6-25, P6-26, P6-27 on this run's database (the small sample taxonomy is loaded: Software Developers, whose
// titles include "Software Engineer", and Python, Git). Postings go in through the real pipeline.

const stamp = Date.now();
let raw, db, source;
const item = (slug, title, description, extra = {}) => ({
  slug: `${slug}-${stamp}`, company_name: "Acme", title, description, remote: true, url: `https://jobs.example/${slug}-${stamp}`,
  tags: [], job_types: ["internship"], location: "Remote", created_at: Math.floor(Date.now() / 1000) - 3600, ...extra,
});
async function ingest(items) {
  const b = await receiveBatch(db, source, items, `m-${stamp}-${Math.random()}`);
  await processBatch(db, b.batchId);
}

beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  db = new PrismaClient({ datasourceUrl: inject("databaseUrl"), omit: OWNER_OMIT }).$extends(tenancy);
  source = await raw.jobSource.create({ data: { key: `test-match-${stamp}`, kind: "arbeitnow", name: "Arbeitnow (test)" } });
});
afterAll(async () => {
  await raw.jobSource.deleteMany({ where: { key: `test-match-${stamp}` } });
  await raw.$disconnect();
  await db.$disconnect();
});

describe("matching", () => {
  let filter;
  it("a new filter is matched against recent postings at once, with reasons", async () => {
    await ingest([
      item("swe", "Software Engineer Intern", "<p>You will write Python and use Git every day.</p>"),
      item("nurse", "Night Nurse", "<p>Care for patients.</p>"),
      item("senior", "Senior Software Engineer", "<p>Python.</p>", { job_types: ["full time"] }),
    ]);
    // the owner\x27s filter, through the API (made → JobFilterChanged → backfill)
    filter = await ok(post("/api/job-filters", { name: `Dev internships ${stamp}`, spec: {
      occupations: [{ code: "onet:15-1252.00", label: "Software Developers" }],
      skills: { must: [], nice: [{ code: "onet-tech:Python", label: "Python" }, { code: "onet-tech:Git", label: "Git" }] },
      employmentTypes: ["internship"], workModes: ["remote"],
    } }));
    const { items } = await ok(get(`/api/radar/matches?filterId=${filter.id}`));
    expect(items.map((m) => m.posting.title)).toEqual([`Software Engineer Intern`]); // not the nurse, not the full-time senior
    expect(items[0].reasons).toEqual(["Matches: Software Developers", "Skills: Python, Git", "Internship", "Remote", expect.stringMatching(/^Posted /)]);
    expect(items[0].posting).toMatchObject({ company: "Acme", source: "Arbeitnow", url: expect.stringContaining("/swe-") });
  });

  it("new postings are matched against everyone's filters, once", async () => {
    await ingest([item("swe2", "Software Engineer Intern (m/f/d) Berlin", "<p>Python please.</p>")]);
    expect(await matchNewPostings(db)).toBeGreaterThanOrEqual(1);
    expect(await matchNewPostings(db)).toBe(0); // already matched
    const { items } = await ok(get(`/api/radar/matches?filterId=${filter.id}`));
    expect(items.map((m) => m.posting.title)).toContain("Software Engineer Intern (m/f/d) Berlin");
  });

  it("a changed filter is matched again: what no longer fits goes, unless you saved it", async () => {
    const { items } = await ok(get(`/api/radar/matches?filterId=${filter.id}`));
    const kept = items.find((m) => m.posting.title === "Software Engineer Intern");
    await ok(patch(`/api/radar/matches/${kept.id}`, { status: "saved" }));
    await ok(patch(`/api/job-filters/${filter.id}`, { spec: { titles: ["Data Analyst"] } }));
    const after = await ok(get(`/api/radar/matches?filterId=${filter.id}`));
    expect(after.items.map((m) => m.posting.title)).toEqual(["Software Engineer Intern"]); // only the saved one stays
    await ok(patch(`/api/job-filters/${filter.id}`, { spec: { occupations: [{ code: "onet:15-1252.00", label: "Software Developers" }], employmentTypes: ["internship"], skills: { must: [], nice: [{ code: "onet-tech:Python", label: "Python" }] } } }));
  });

  it("👍/👎 teach the filter which skills matter (changing your mind undoes it); 👎 also hides the match", async () => {
    const { items } = await ok(get(`/api/radar/matches?filterId=${filter.id}`));
    const m = items[0];
    await ok(patch(`/api/radar/matches/${m.id}`, { feedback: 1 }));
    expect((await raw.jobFilter.findUnique({ where: { id: filter.id } })).weights).toEqual({ "onet-tech:Python": 1.25 });
    const down = await ok(patch(`/api/radar/matches/${m.id}`, { feedback: -1 }));
    expect(down).toMatchObject({ feedback: -1, status: "dismissed" });
    expect((await raw.jobFilter.findUnique({ where: { id: filter.id } })).weights).toEqual({ "onet-tech:Python": 0.8 });
    await ok(patch(`/api/radar/matches/${m.id}`, { feedback: 0, status: "new" }));
    expect((await raw.jobFilter.findUnique({ where: { id: filter.id } })).weights).toEqual({ "onet-tech:Python": 1 });
  });

  it("Apply makes a Job application (once), and the pet notices", async () => {
    const { items } = await ok(get(`/api/radar/matches?filterId=${filter.id}`));
    const m = items[0];
    const r = await ok(post(`/api/radar/matches/${m.id}/apply`));
    expect(r.match.status).toBe("applied");
    const app = await ok(get(`/api/jobs/${r.applicationId}`));
    expect(app).toMatchObject({ company: "Acme", title: m.posting.title, url: m.posting.url, status: "wishlist", source: "Job Radar · via Arbeitnow" });
    expect(app.notes).toMatch(/^Why it fits: Matches: Software Developers/);
    expect((await ok(post(`/api/radar/matches/${m.id}/apply`))).applicationId).toBe(r.applicationId); // a second click: the same one
    expect(await raw.petXp.count({ where: { key: `apply:${r.applicationId}` } })).toBeLessThanOrEqual(1);
    expect((await patch("/api/radar/matches/999999", { status: "seen" })).status).toBe(404);
  });

  it("someone else's filter finds the same postings, but each sees only their own matches", async () => {
    const other = `radar-other-${stamp}`;
    await raw.user.create({ data: { id: other, name: "Other", email: `${other}@example.com` } });
    try {
      const f = await asUser(other, async () => await db.jobFilter.create({ data: { name: "Theirs", spec: { titles: ["Software Engineer"] } } }));
      await asUser(other, () => backfillFilter(db, f.id));
      expect(await raw.jobMatch.count({ where: { userId: other } })).toBeGreaterThanOrEqual(2);
      const mine = await ok(get("/api/radar/matches?limit=100"));
      expect(mine.items.every((m) => m.filterName !== "Theirs")).toBe(true);
    } finally {
      await raw.user.delete({ where: { id: other } });
    }
    await ok(del(`/api/job-filters/${filter.id}`));
  });
});

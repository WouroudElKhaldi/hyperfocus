import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { clockIn } from "../../src/clock.ts";
import { processBatch, receiveBatch } from "../../src/radar/ingest.ts";
import { del, get, ok, patch, post } from "../support/api.js";

// P6-30: a saved job reaches the rest of the app: the calendar and a reminder, a "Prepare" task, the Skills map.

const stamp = Date.now();
let raw, source, filter, match;

beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  source = await raw.jobSource.create({ data: { key: `test-tie-${stamp}`, kind: "arbeitnow", name: "Arbeitnow (test)" } });
  const b = await receiveBatch(raw, source, [{
    slug: `tie-${stamp}`, company_name: `Tie Co ${stamp}`, title: `Junior Python Developer ${stamp}`, description: "<p>Python and Git every day.</p>",
    remote: true, url: `https://jobs.example/tie-${stamp}`, tags: [], job_types: ["full time"], location: "Remote", created_at: Math.floor(Date.now() / 1000) - 3600,
  }], `tie-${stamp}`);
  await processBatch(raw, b.batchId);
  filter = await ok(post("/api/job-filters", { name: `Tie ${stamp}`, spec: { titles: ["Python Developer"], keywords: { include: [String(stamp)], exclude: [], scope: ["title"] }, digest: "off" } }));
  match = (await ok(get(`/api/radar/matches?filterId=${filter.id}`))).items[0];
});
afterAll(async () => {
  const row = await raw.jobMatch.findUnique({ where: { id: match.id } });
  await raw.event.deleteMany({ where: { id: row.eventId ?? -1 } });
  await raw.reminder.deleteMany({ where: { id: row.reminderId ?? -1 } });
  await raw.task.deleteMany({ where: { id: row.taskId ?? -1 } });
  await raw.skill.deleteMany({ where: { notes: { contains: String(stamp) } } });
  await del(`/api/job-filters/${filter.id}`);
  await raw.jobSource.deleteMany({ where: { key: `test-tie-${stamp}` } });
  await raw.$disconnect();
});

describe("Job Radar tie-ins", () => {
  it("saving puts the closing day on the calendar, with a reminder before it; saving again adds nothing", async () => {
    expect(match.posting.title).toBe(`Junior Python Developer ${stamp}`);
    const saved = await ok(patch(`/api/radar/matches/${match.id}`, { status: "saved" }));
    expect(saved.eventId).toEqual(expect.any(Number));
    const event = await raw.event.findUnique({ where: { id: saved.eventId } });
    expect(event).toMatchObject({ title: `Last day to apply: Junior Python Developer ${stamp} at Tie Co ${stamp}`, allDay: true, category: "work", notes: match.posting.url });
    const { timeZone } = await ok(get("/api/settings"));
    expect(event.day).toBe(clockIn(timeZone, new Date(match.posting.expiresAt)).day); // (the closing day on your own clock)
    const row = await raw.jobMatch.findUnique({ where: { id: match.id } });
    const reminder = await raw.reminder.findUnique({ where: { id: row.reminderId } });
    expect(reminder.title).toBe(`Apply to Junior Python Developer ${stamp} at Tie Co ${stamp}`);
    expect(reminder.at.getTime()).toBeLessThan(new Date(match.posting.expiresAt).getTime());
    await ok(patch(`/api/radar/matches/${match.id}`, { status: "seen" }));
    expect((await ok(patch(`/api/radar/matches/${match.id}`, { status: "saved" }))).eventId).toBe(saved.eventId);
    expect(await raw.event.count({ where: { title: event.title } })).toBe(1);
  });

  it("Prepare makes one high-priority task with steps, due before the closing day", async () => {
    const r = await ok(post(`/api/radar/matches/${match.id}/prepare`));
    const t = await raw.task.findUnique({ where: { id: r.taskId }, include: { steps: true } });
    expect(t).toMatchObject({ title: `Apply: Junior Python Developer ${stamp} at Tie Co ${stamp}`, priority: "high" });
    expect(t.steps.length).toBeGreaterThan(0);
    if (!r.ai) expect(t.steps).toHaveLength(5); // (the plain list when the AI isn't set up)
    expect(t.dueDay <= match.posting.expiresAt.slice(0, 10)).toBe(true);
    expect((await ok(post(`/api/radar/matches/${match.id}/prepare`))).taskId).toBe(r.taskId); // a second click: the same task
  });

  it("skill gaps: what the job asks for and you don't have goes on your Skills map, once", async () => {
    const first = await ok(post(`/api/radar/matches/${match.id}/skill-gaps`));
    const all = [...first.added, ...first.have].sort();
    expect(all).toEqual(expect.arrayContaining(["Git", "Python"]));
    const skills = await ok(get("/api/skills"));
    for (const name of first.added) expect(skills.find((s) => s.name === name)).toMatchObject({ area: "From Job Radar", taxonomyCode: expect.stringMatching(/^(onet-tech|esco):/) });
    const again = await ok(post(`/api/radar/matches/${match.id}/skill-gaps`));
    expect(again.added).toEqual([]);
    expect([...again.have].sort()).toEqual(all);
    expect((await post("/api/radar/matches/999999/skill-gaps")).status).toBe(404);
  });
});

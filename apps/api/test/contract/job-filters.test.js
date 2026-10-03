import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

// P6-20: your Job Radar filters. Made, renamed, switched off, changed, deleted; what they look for is checked against
// the filter shape (JobFilterSpec), and an empty one gets every default. (Another person never sees them: the generated
// tenancy test covers these routes too. One click from a major is tested where the taxonomy is loaded: the browser tests.)

describe("Job Radar filters", () => {
  it("makes a filter with every default, and checks what it asks for", async () => {
    const f = await ok(post("/api/job-filters", { name: "Remote design jobs" }));
    expect(f).toMatchObject({ name: "Remote design jobs", enabled: true, spec: { occupations: [], seniority: [], digest: "daily", salaryMin: null } });
    expect((await post("/api/job-filters", { name: "" })).status).toBe(400);
    expect((await post("/api/job-filters", { name: "x", spec: { seniority: ["boss"] } })).status).toBe(400);
    expect((await post("/api/job-filters", { name: "x", spec: { postedWithinDays: 400 } })).status).toBe(400);
    await ok(del(`/api/job-filters/${f.id}`));
  });

  it("changes, switches off, lists and deletes", async () => {
    const f = await ok(post("/api/job-filters", { name: "First", spec: { workModes: ["remote"], keywords: { include: ["figma"] } } }));
    expect(f.spec).toMatchObject({ workModes: ["remote"], keywords: { include: ["figma"], exclude: [], scope: ["title", "description"] } });
    expect(await ok(patch(`/api/job-filters/${f.id}`, { name: "Renamed", enabled: false }))).toMatchObject({ name: "Renamed", enabled: false, spec: { workModes: ["remote"] } });
    expect(await ok(patch(`/api/job-filters/${f.id}`, { spec: { seniority: ["intern"] } }))).toMatchObject({ spec: { seniority: ["intern"], workModes: [] } });
    expect((await ok(get("/api/job-filters"))).map((x) => x.name)).toContain("Renamed");
    expect((await patch("/api/job-filters/999999", { name: "x" })).status).toBe(404);
    await ok(del(`/api/job-filters/${f.id}`));
    expect((await del(`/api/job-filters/${f.id}`)).status).toBe(404);
  });

  it("allows up to 20, and says so kindly", async () => {
    const made = [];
    for (let i = 0; i < 20; i++) made.push((await ok(post("/api/job-filters", { name: `F${i}` }))).id);
    const r = await post("/api/job-filters", { name: "one too many" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/up to 20 filters/);
    for (const id of made) await ok(del(`/api/job-filters/${id}`));
  });

  it("from a major: needs a real field of study", async () => {
    expect((await post("/api/job-filters/from-preset", { fieldCode: "cip:99.9999" })).status).toBe(404);
    expect((await post("/api/job-filters/from-preset", { fieldCode: "computer science" })).status).toBe(400);
  });
});

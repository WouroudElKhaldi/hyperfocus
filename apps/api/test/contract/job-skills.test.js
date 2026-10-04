import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { get, ok, post, put } from "../support/api.js";

// Skills for my job: from the shared job list (the sample taxonomy here: Software Developers, with Python and Git), added
// to the Skills map linked to the standard skill; a title nobody had gets its skills named once by the AI (the test AI
// here) and stored for everyone. Works without the AI.

const stamp = Date.now();
let raw, before;
beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  before = await ok(get("/api/profile"));
});
afterAll(async () => {
  await ok(put("/api/profile", { role: before.role, occupationCode: before.occupationCode ?? "" }));
  await raw.skill.deleteMany({ where: { area: "Software Developers" } });
  await raw.occupation.deleteMany({ where: { code: { startsWith: `local:basket-weaver-${stamp}` } } });
  await raw.$disconnect();
});

describe("skills for my job", () => {
  it("pick a job from the list: its skills, tools in demand first; it is saved in your profile", async () => {
    const r = await ok(put("/api/skills/job", { code: "onet:15-1252.00" }));
    expect(r.job).toEqual({ code: "onet:15-1252.00", title: "Software Developers" });
    expect(r.skills.map((s) => s.name)).toEqual(expect.arrayContaining(["Python", "Git"]));
    expect(r.skills[0].hot).toBe(true);
    expect((await ok(get("/api/profile"))).occupationCode).toBe("onet:15-1252.00");
    expect((await ok(get("/api/skills/for-job"))).job.title).toBe("Software Developers");
    expect((await put("/api/skills/job", { code: "onet:99-9999.99" })).status).toBe(400);
  });

  it("add some to your Skills map, linked to the standard skill; added twice, only once", async () => {
    const { skills } = await ok(get("/api/skills/for-job"));
    const python = skills.find((s) => s.name === "Python");
    expect(await ok(post("/api/skills/from-job", { codes: [python.code] }))).toEqual({ added: ["Python"] });
    expect(await ok(post("/api/skills/from-job", { codes: [python.code] }))).toEqual({ added: [] });
    const mine = (await ok(get("/api/skills"))).find((s) => s.name === "Python" && s.area === "Software Developers");
    expect(mine).toMatchObject({ taxonomyCode: python.code });
    expect((await ok(get("/api/skills/for-job"))).skills.find((s) => s.name === "Python").have).toBe(true);
  });

  it("a typed title that is one of a job's names finds that job", async () => {
    expect((await ok(put("/api/skills/job", { title: "software engineer" }))).job.code).toBe("onet:15-1252.00");
  });

  it("a title nobody had: the AI names its skills once, stored for everyone; the next time no AI is needed", async () => {
    const title = `Basket Weaver ${stamp}`;
    const r = await ok(put("/api/skills/job", { title }));
    expect(r).toMatchObject({ job: { code: `local:basket-weaver-${stamp}`, title }, learned: true });
    expect(r.skills.length).toBeGreaterThan(0); // (the test AI names "Designing REST APIs")
    const stored = await raw.occupation.findUnique({ where: { code: `local:basket-weaver-${stamp}` }, include: { skills: true } });
    expect(stored).toMatchObject({ source: "local", version: "ai" });
    expect(stored.skills.length).toBe(r.skills.length);
    expect(await ok(put("/api/skills/job", { title }))).toMatchObject({ learned: false, job: { code: `local:basket-weaver-${stamp}` } });
  });
});

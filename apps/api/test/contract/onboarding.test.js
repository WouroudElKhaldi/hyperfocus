import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { get } from "../support/api.js";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";
import { seedTaxonomy } from "../support/taxonomy-fixture.js";

// P5-05: the welcome guide. Someone new sees it once; finishing it sets their name, makes their Job Radar filter from
// what they study when they want help finding jobs, and says which page to open. The owner in local mode never sees it.

const stamp = Date.now();
let api, ana, sam;
beforeAll(async () => {
  api = await startExtraApi("onboarding", { ...CLOUD, ADMIN_EMAILS: `ana-${stamp}@example.com` }); // (Job Radar: admins only while it is tested)
  await seedTaxonomy(api.dbUrl); // (its own database: the sample job list, with Computer Science)
  [ana, sam] = await Promise.all([signUp(api, `ana-${stamp}@example.com`, "Ana"), signUp(api, `sam-${stamp}@example.com`, "Sam")]);
}, 120000);
afterAll(async () => { await api?.stop(); });

describe("welcome guide", () => {
  it("local mode: the owner has nothing to fill in", async () => {
    expect((await get("/api/me")).body.onboarded).toBe(true);
  });

  it("someone new sees it; finishing it with Computer Science and jobs makes their filter and opens Job Radar", async () => {
    expect((await ana.json("GET", "/api/me")).onboarded).toBe(false);
    const done = await ana.json("POST", "/api/onboarding", { name: "Ana María", fieldCode: "cip:11.0701", helpWith: ["focus", "jobs"] });
    expect(done).toEqual({ filterId: expect.any(Number), next: "/radar" });
    const me = await ana.json("GET", "/api/me");
    expect(me).toMatchObject({ onboarded: true, user: { name: "Ana María" } });
    // what they study becomes their title (the AI fits its help to it)
    expect(await ana.json("GET", "/api/profile")).toMatchObject({ name: "Ana María", role: "Computer Science student" });
    const filters = await ana.json("GET", "/api/job-filters");
    expect(filters).toHaveLength(1);
    expect(filters[0].name).toBe("Computer Science jobs");
    expect(filters[0].spec.occupations.map((o) => o.code)).toContain("onet:15-1252.00");
    // a second time: no second filter
    expect((await ana.json("POST", "/api/onboarding", { name: "Ana", fieldCode: "cip:11.0701", helpWith: ["jobs"] })).filterId).toBeNull();
    expect(await ana.json("GET", "/api/job-filters")).toHaveLength(1);
  });

  it("Job Radar isn't open to Sam (not an admin): \"find jobs\" makes no filter and opens Job applications", async () => {
    expect((await sam.json("GET", "/api/me")).radar).toBe(false);
    expect((await ana.json("GET", "/api/me")).radar).toBe(true);
    expect((await sam.call("GET", "/api/job-filters")).status).toBe(403);
    expect((await sam.call("GET", "/api/radar/matches")).status).toBe(403);
    expect((await sam.call("GET", "/api/jobs")).status).toBe(200); // job applications stay open to everyone
    expect(await sam.json("POST", "/api/onboarding", { name: "Sam", fieldCode: "cip:11.0701", helpWith: ["jobs"] })).toEqual({ filterId: null, next: "/jobs" });
  });

  it("an admin switches the job-radar flag on: Job Radar opens for everyone; off again, closed", async () => {
    await ana.json("PUT", "/api/admin/flags/job-radar", { enabled: true });
    expect((await sam.json("GET", "/api/me")).radar).toBe(true);
    expect((await sam.call("GET", "/api/job-filters")).status).toBe(200);
    await ana.json("PUT", "/api/admin/flags/job-radar", { enabled: false });
    expect((await sam.call("GET", "/api/job-filters")).status).toBe(403);
  });

  it("P5-14: the longer guide saves studies, situation, brain, what helps and tone; Profile changes them; only their own", async () => {
    const about = { pronouns: "he", studyLevel: "bachelor", school: "Lebanese University", studyYear: "3", situation: "both", neuro: ["adhd", "autism", "adhd"], neuroNote: "Long texts overwhelm me", supports: ["smallSteps", "timers"], tone: "direct", bestTime: "night", focusMins: 15 };
    await sam.json("POST", "/api/onboarding", { name: "Sam", fieldCode: "cip:11.0701", helpWith: ["study"], about });
    const p = await sam.json("GET", "/api/profile");
    // the field of study fills the major when they didn't type one; a repeated choice is kept once
    expect(p).toMatchObject({ ...about, neuro: ["adhd", "autism"], major: "Computer Science" });
    // Profile: change one answer, clear another; the rest stays
    const changed = await sam.json("PUT", "/api/profile", { tone: "gentle", neuro: [] });
    expect(changed).toMatchObject({ tone: "gentle", neuro: [], supports: ["smallSteps", "timers"], focusMins: 15 });
    // wrong choices are refused
    for (const bad of [{ neuro: ["vampire"] }, { tone: "loud" }, { focusMins: 7 }, { studyYear: "9" }]) expect((await sam.call("PUT", "/api/profile", bad)).status).toBe(400);
    // Ana's profile doesn't have any of it
    expect((await ana.json("GET", "/api/profile")).neuro).toEqual([]);
  });

  it("the AI waits for a filled-in profile: /api/me says so, and an AI call explains what to do (owner, 2026-10-04)", async () => {
    const lee = await signUp(api, `lee-${stamp}@example.com`, "Lee", { profile: false });
    expect((await lee.json("GET", "/api/me")).profileReady).toBe(false);
    await lee.json("PUT", "/api/integrations/deepseek", { apiKey: "sk-lee-own-key-123456" }); // (their own key: only the profile is missing)
    const refused = await lee.call("POST", "/api/ai/steps", { task: "Plan my week" });
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toMatch(/^Fill in your profile first/);
    await lee.json("PUT", "/api/profile", { name: "Lee", studyLevel: "master" });
    expect((await lee.json("GET", "/api/me")).profileReady).toBe(true);
  });

  it("without jobs no filter is made; skipping works; a wrong field is refused", async () => {
    expect((await sam.call("POST", "/api/onboarding", { name: "Sam", fieldCode: "physics", helpWith: [] })).status).toBe(400);
    expect((await sam.call("POST", "/api/onboarding", { name: "", helpWith: [] })).status).toBe(400);
    expect((await sam.call("POST", "/api/onboarding/skip")).status).toBe(204);
    expect((await sam.json("GET", "/api/me")).onboarded).toBe(true);
    expect(await sam.json("POST", "/api/onboarding", { name: "Sam", fieldCode: "cip:11.0701", helpWith: ["study", "tasks"] })).toEqual({ filterId: null, next: "/study" });
    expect((await sam.call("GET", "/api/job-filters")).status).toBe(403); // (and no filter: Job Radar is closed to Sam)
  });
});

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
  api = await startExtraApi("onboarding", CLOUD);
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
    const filters = await ana.json("GET", "/api/job-filters");
    expect(filters).toHaveLength(1);
    expect(filters[0].name).toBe("Computer Science jobs");
    expect(filters[0].spec.occupations.map((o) => o.code)).toContain("onet:15-1252.00");
    // a second time: no second filter
    expect((await ana.json("POST", "/api/onboarding", { name: "Ana", fieldCode: "cip:11.0701", helpWith: ["jobs"] })).filterId).toBeNull();
    expect(await ana.json("GET", "/api/job-filters")).toHaveLength(1);
  });

  it("without jobs no filter is made; skipping works; a wrong field is refused", async () => {
    expect((await sam.call("POST", "/api/onboarding", { name: "Sam", fieldCode: "physics", helpWith: [] })).status).toBe(400);
    expect((await sam.call("POST", "/api/onboarding", { name: "", helpWith: [] })).status).toBe(400);
    expect((await sam.call("POST", "/api/onboarding/skip")).status).toBe(204);
    expect((await sam.json("GET", "/api/me")).onboarded).toBe(true);
    expect(await sam.json("POST", "/api/onboarding", { name: "Sam", fieldCode: "cip:11.0701", helpWith: ["study", "tasks"] })).toEqual({ filterId: null, next: "/study" });
    expect(await sam.json("GET", "/api/job-filters")).toHaveLength(0);
  });
});

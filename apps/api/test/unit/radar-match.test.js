import { emptyJobFilter } from "@hyperfocus/shared";
import { describe, expect, it } from "vitest";
import { passes, score } from "../../src/radar/match.ts";

// P6-21 (each filter type) and P6-22 (scores with reasons). Unknown never rules a posting out.

const now = new Date("2026-10-04T12:00:00Z");
const posting = (over = {}) => ({
  id: 1, title: "Junior Software Developer", company: "Acme", description: "We use Python and Git. Remote friendly.",
  countryCode: "LB", cityId: 276781, workMode: "remote", employmentType: "full_time", seniority: "junior", educationLevel: "bachelor",
  yearsMin: 1, salaryMin: 30000, salaryMax: 40000, salaryCurrency: "USD", salaryPeriod: "year", visaSponsorship: null,
  occupationCode: "onet:15-1252.00", postedAt: new Date("2026-10-02T12:00:00Z"), skillCodes: ["onet-tech:Python", "onet-tech:Git"], ...over,
});
const spec = (over = {}) => ({ ...emptyJobFilter(), ...over });
const ctx = { occupationTitles: new Map([["onet:15-1252.00", ["Software Developer", "Software Engineer", "Programmer"]]]), fieldOccupations: new Set(["onet:15-1252.00"]) };
const unknown = posting({ workMode: null, employmentType: null, seniority: null, educationLevel: null, yearsMin: null, salaryMin: null, salaryMax: null, countryCode: "", cityId: null });

describe("hard filters, one by one (a contradiction rules out; unknown never does)", () => {
  const cases = [
    ["employment type", { employmentTypes: ["internship"] }],
    ["seniority", { seniority: ["senior"] }],
    ["work mode", { workModes: ["onsite"] }],
    ["education", { educationLevel: "secondary" }],
    ["years of experience", { maxYearsExperience: 0 }],
    ["visa", { visaSponsorship: true }, { visaSponsorship: false }],
    ["posted within", { postedWithinDays: 1 }],
    ["salary", { salaryMin: { amount: 50000, currency: "USD" } }],
    ["company include", { companies: { include: ["Other Co"], exclude: [] } }],
    ["company exclude", { companies: { include: [], exclude: ["acme"] } }],
    ["location", { locations: [{ code: "FR", label: "France", radiusKm: null }] }],
    ["must-have skill", { skills: { must: [{ code: "onet-tech:Java", label: "Java" }], nice: [] } }],
    ["excluded keyword", { keywords: { include: [], exclude: ["python"], scope: ["title", "description"] } }],
  ];
  for (const [name, s, postingOver] of cases) {
    it(name, () => {
      expect(passes(spec(s), posting(postingOver), now)).toBe(false);
      if (name !== "posted within" && name !== "company include" && name !== "company exclude" && name !== "must-have skill" && name !== "excluded keyword") {
        expect(passes(spec(s), unknown, now), `${name}: unknown passes`).toBe(true);
      }
    });
  }
  it("what the posting does say, when it fits, passes", () => {
    expect(passes(spec({ employmentTypes: ["full_time"], seniority: ["junior"], workModes: ["remote"], educationLevel: "master", maxYearsExperience: 2, salaryMin: { amount: 35000, currency: "USD" }, locations: [{ code: "geonames:276781", label: "Beirut", radiusKm: null }] }), posting(), now)).toBe(true);
    expect(passes(spec({ salaryMin: { amount: 99999, currency: "EUR" } }), posting(), now)).toBe(true); // another currency: can't compare, not ruled out
    expect(passes(spec({ locations: [{ code: "FR", label: "France", radiusKm: null }], workModes: ["remote"] }), posting({ countryCode: "", cityId: null }), now)).toBe(true); // remote, anywhere
  });
});

describe("scores and reasons", () => {
  it("explains every match in words", () => {
    const r = score(spec({ occupations: [{ code: "onet:15-1252.00", label: "Software Developers" }], skills: { must: [], nice: [{ code: "onet-tech:Python", label: "Python" }, { code: "onet-tech:Git", label: "Git" }, { code: "onet-tech:Java", label: "Java" }] }, workModes: ["remote"], employmentTypes: ["full_time"] }), posting(), ctx, {}, now);
    expect(r.reasons).toEqual(["Matches: Software Developers", "Skills: Python, Git", "Full time", "Remote", "Posted 2 days ago"]);
    expect(r.score).toBeGreaterThan(0.7);
  });

  it("finds the job by one of its titles when the posting isn't classified", () => {
    const r = score(spec({ occupations: [{ code: "onet:15-1252.00", label: "Software Developers" }] }), posting({ occupationCode: null, title: "Software Engineer (m/f/d)" }), ctx, {}, now);
    expect(r.reasons[0]).toBe("Matches: Software Developers");
  });

  it("a filter that asks for something specific needs at least one of it; an empty filter takes everything", () => {
    expect(score(spec({ titles: ["Nurse"] }), posting({ occupationCode: null }), ctx, {}, now)).toBeNull();
    expect(score(spec(), posting(), ctx, {}, now)).toMatchObject({ reasons: ["Posted 2 days ago"] });
    expect(score(spec({ fieldsOfStudy: [{ code: "cip:11.0701", label: "Computer Science" }] }), posting(), ctx, {}, now).reasons[0]).toBe("Matches: a job Computer Science leads to");
  });

  it("better fits score higher; fresher scores higher; 👎 on a skill lowers what it is worth", () => {
    const s = spec({ skills: { must: [], nice: [{ code: "onet-tech:Python", label: "Python" }, { code: "onet-tech:Rust", label: "Rust" }] } });
    const both = score(s, posting({ skillCodes: ["onet-tech:Python", "onet-tech:Rust"] }), ctx, {}, now).score;
    const one = score(s, posting(), ctx, {}, now).score;
    expect(both).toBeGreaterThan(one);
    expect(score(s, posting({ postedAt: new Date("2026-09-10T12:00:00Z") }), ctx, {}, now).score).toBeLessThan(one);
    expect(score(s, posting(), ctx, { "onet-tech:Python": 0.2 }, now).score).toBeLessThan(one);
  });
});

import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { ADAPTERS } from "../../src/radar/adapters.ts";
import { classify } from "../../src/radar/classify.ts";
import { htmlToText } from "../../src/radar/text.ts";

// P6-12 + P6-15: the source adapters on answers recorded from the real APIs (4 postings each, 2026-10-03), and the
// classifier on them and on small made-up texts.

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`../fixtures/sources/${name}.json`, import.meta.url), "utf8"));
const all = (kind, items, config = {}) => items.map((i) => ADAPTERS[kind].normalise(i, config));

describe("source adapters (recorded answers)", () => {
  it("Arbeitnow: every field, HTML to text, the remote flag, contract words, Unix-seconds dates, the next page", async () => {
    const page = await ADAPTERS.arbeitnow.fetchPage({}, null, async () => fixture("arbeitnow"));
    expect(page.items).toHaveLength(4);
    expect(page.next).toBe("https://www.arbeitnow.com/api/job-board-api?page=2");
    const [remote, , onsite] = all("arbeitnow", page.items);
    expect(remote).toMatchObject({ title: "Provider Credentialing and Practice Lead", company: "Neko Health", remote: true, employmentHint: "Full Time", externalId: expect.any(String) });
    expect(remote.url).toMatch(/^https:\/\/www\.arbeitnow\.com\//);
    expect(remote.postedAt.toISOString()).toBe(new Date(1791038410 * 1000).toISOString()); // created_at, in seconds
    expect(onsite).toMatchObject({ title: "Management Accountant", locationText: "Freiburg (Germany)", remote: false });
    expect(onsite.description).not.toMatch(/<[a-z]/i); // plain text
    expect(onsite.description).toContain("Black Forest Labs");
  });

  it("Greenhouse: escaped HTML content, the company, ISO dates with a time zone", () => {
    const [first] = all("greenhouse", fixture("greenhouse").jobs, { board: "gitlab" });
    expect(first).toMatchObject({ title: "Account Executive - France", company: "GitLab", locationText: "Remote, France", url: "https://job-boards.greenhouse.io/gitlab/jobs/8860302002", externalId: "8860302002" });
    expect(first.postedAt.toISOString()).toBe("2026-10-02T15:31:50.000Z");
    expect(first.description).not.toMatch(/&lt;|<p>/);
  });

  it("Lever: plain text with its lists, country code, workplace type, commitment, millisecond dates", () => {
    const [android, contractor] = all("lever", fixture("lever"), { board: "spotify", company: "Spotify" });
    expect(android).toMatchObject({ title: "Android Engineer - Experience", company: "Spotify", locationText: "London; Stockholm", countryCode: "GB", workModeHint: "hybrid", employmentHint: "Permanent" });
    expect(contractor).toMatchObject({ countryCode: "VN", employmentHint: "Short Term" });
    expect(android.postedAt.getUTCFullYear()).toBe(2026);
  });

  it("refuses an item that breaks the shape, with a clear reason (a source changed its format)", async () => {
    expect(() => ADAPTERS.arbeitnow.normalise({ slug: "x", title: "", url: "not a url", created_at: 1 })).toThrow();
    await expect(ADAPTERS.greenhouse.fetchPage({ board: "../../etc" }, null, async () => ({}))).rejects.toThrow(/Not a board name/);
  });
});

describe("classifier", () => {
  const posting = (over) => ({ externalId: "x", url: "https://x.example", title: "Developer", company: "", description: "", locationText: "", countryCode: null, remote: null, workModeHint: "", employmentHint: "", tags: [], postedAt: new Date(), closesAt: null, salary: null, ...over });

  it("on the recorded postings", () => {
    const [a1, a2, a3] = all("arbeitnow", fixture("arbeitnow").data).map(classify);
    expect(a1).toMatchObject({ workMode: "remote", employmentType: "full_time", seniority: "lead", salary: { min: 137000, max: 167000, currency: "USD", period: "year" } });
    expect(a2).toMatchObject({ workMode: "remote", seniority: "mid", educationLevel: "master", yearsMin: 3 });
    expect(a3).toMatchObject({ workMode: "onsite", educationLevel: "bachelor", salary: { min: 70000, max: 100000, currency: "EUR" } });
    const g = all("greenhouse", fixture("greenhouse").jobs, { board: "gitlab" }).map(classify);
    expect(g[1].salary).toMatchObject({ min: 139200, max: expect.any(Number), currency: "USD" }); // "$139,200—$208,800": an em dash
    const [android, contractor] = all("lever", fixture("lever"), { board: "spotify" }).map(classify);
    expect(android).toMatchObject({ workMode: "hybrid", employmentType: "full_time" });
    expect(contractor).toMatchObject({ employmentType: "contract", yearsMin: 3 });
  });

  it("reads the title before the text, and leaves unknown unknown", () => {
    expect(classify(posting({ title: "Software Engineering Intern" }))).toMatchObject({ employmentType: "internship", seniority: "intern" });
    expect(classify(posting({ title: "Werkstudent Marketing (m/w/d)" }))).toMatchObject({ employmentType: "student_job", seniority: "student" });
    expect(classify(posting({ title: "Junior Data Analyst", description: "You will work with senior engineers." }))).toMatchObject({ seniority: "junior" });
    expect(classify(posting({ title: "Data Analyst", description: "At least 5 years of experience in SQL." }))).toMatchObject({ yearsMin: 5, seniority: "mid" });
    expect(classify(posting({ title: "Graduate Engineer" }))).toMatchObject({ seniority: "entry" });
    expect(classify(posting({ title: "Analyst", description: "A role in our team." }))).toEqual({ workMode: null, employmentType: null, seniority: null, educationLevel: null, yearsMin: null, salary: null, visaSponsorship: null });
  });

  it("salary, visa and work mode from the text", () => {
    expect(classify(posting({ description: "Pay: $25 per hour." })).salary).toEqual({ min: 25, max: null, currency: "USD", period: "hour" });
    expect(classify(posting({ description: "€45k – €55k a year" })).salary).toEqual({ min: 45000, max: 55000, currency: "EUR", period: "year" });
    expect(classify(posting({ description: "Get $5 off your first order" })).salary).toBeNull();
    expect(classify(posting({ description: "Visa sponsorship is available for this role." })).visaSponsorship).toBe(true);
    expect(classify(posting({ description: "We are unable to sponsor visas." })).visaSponsorship).toBe(false);
    expect(classify(posting({ description: "This is a hybrid role, 3 days a week in the office." })).workMode).toBe("hybrid");
  });

  it("HTML to text keeps lines and decodes entities", () => {
    expect(htmlToText("<p>Hello &amp; welcome</p><ul><li>One</li><li>Two&nbsp;too</li></ul><script>alert(1)</script>")).toBe("Hello & welcome\n• One\n• Two too");
    expect(htmlToText("&lt;p&gt;Escaped &amp;amp; fine&lt;/p&gt;")).toBe("Escaped & fine");
  });
});

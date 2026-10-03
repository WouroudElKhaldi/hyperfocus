import { afterEach, describe, expect, it } from "vitest";
import { ADAPTERS } from "../../src/radar/adapters.ts";
import { NOT_GRANTED, linkedinJobs, useLinkedInJobsProvider } from "../../src/radar/linkedin-jobs.ts";

// P6-19: LinkedIn jobs are the shape only, off by default, until LinkedIn grants partner access (ADR-012).

const job = { id: "li-1", url: "https://www.linkedin.com/jobs/view/1", title: "Data Analyst Intern", company: "Cedar", descriptionHtml: "<p>SQL and Excel.</p>", location: "Beirut", workplaceType: "hybrid", employmentType: "INTERNSHIP", listedAt: new Date("2026-10-01T00:00:00Z") };
afterEach(() => useLinkedInJobsProvider(null));

describe("LinkedIn jobs provider", () => {
  it("is off by default: the app's own adapter is skipped and refuses to fetch", async () => {
    expect(ADAPTERS.linkedin.enabled()).toBe(false);
    await expect(ADAPTERS.linkedin.fetchPage({}, null, async () => ({}))).rejects.toThrow(NOT_GRANTED);
  });

  it("switched on but with no provider: still skipped", () => {
    expect(linkedinJobs(() => true).enabled()).toBe(false);
  });

  it("switched on with a provider: pages come through and become postings", async () => {
    useLinkedInJobsProvider({ page: async (cursor) => ({ jobs: cursor ? [] : [job], next: cursor ? null : "2" }) });
    const a = linkedinJobs(() => true);
    expect(a.enabled()).toBe(true);
    const first = await a.fetchPage({}, null, async () => ({}));
    expect(first.next).toBe("2");
    expect(a.normalise(first.items[0], {})).toMatchObject({ externalId: "li-1", title: "Data Analyst Intern", company: "Cedar", description: "SQL and Excel.", remote: false, employmentHint: "internship" });
  });
});

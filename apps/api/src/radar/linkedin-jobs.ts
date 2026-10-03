import type { Adapter } from "./adapters.ts";
import { JobPostingDTO } from "./dto.ts";
import { htmlToText } from "./text.ts";

// LinkedIn jobs (P6-19, ADR-012): the shape only. LinkedIn lets apps read job postings only with official partner
// access, and scraping is not allowed, so nothing here talks to LinkedIn. When access is granted, the code that calls
// their API implements LinkedInJobsProvider and is registered with useLinkedInJobsProvider; the source is then switched
// on with LINKEDIN_JOBS=1. Until both happen, a "linkedin" source is skipped. (Posting to LinkedIn is separate: each
// person connects their own LinkedIn app in Settings.)

/** One job as the provider hands it over (already in LinkedIn's own words). */
export type LinkedInJob = {
  id: string;
  url: string;
  title: string;
  company: string;
  descriptionHtml: string;
  location: string;
  workplaceType: "on-site" | "hybrid" | "remote" | "";
  employmentType: string; // "FULL_TIME", "INTERNSHIP"…
  listedAt: Date;
};

export interface LinkedInJobsProvider {
  /** One page of jobs after `cursor` (null = from the start); `next` null when there are no more. */
  page(cursor: string | null): Promise<{ jobs: LinkedInJob[]; next: string | null }>;
}

let provider: LinkedInJobsProvider | null = null;
/** Registers the real provider (once partner access exists), or a fake one in tests. */
export function useLinkedInJobsProvider(p: LinkedInJobsProvider | null): void {
  provider = p;
}

export const NOT_GRANTED = "LinkedIn jobs need LinkedIn's partner access (ADR-012): no provider is set up.";

export const linkedinJobs = (switchedOn: () => boolean): Adapter => ({
  kind: "linkedin",
  label: "LinkedIn",
  everyMinutes: 60,
  enabled: () => switchedOn() && provider !== null,
  async fetchPage(_config, cursor) {
    if (!switchedOn() || !provider) throw new Error(NOT_GRANTED);
    const { jobs, next } = await provider.page(cursor);
    return { items: jobs, next };
  },
  normalise(item) {
    const j = item as LinkedInJob;
    return JobPostingDTO.parse({
      externalId: j.id,
      url: j.url,
      title: j.title,
      company: j.company,
      description: htmlToText(j.descriptionHtml),
      locationText: j.location,
      remote: j.workplaceType === "remote" ? true : j.workplaceType ? false : null,
      employmentHint: j.employmentType.replace(/_/g, " ").toLowerCase(),
      tags: [],
      postedAt: j.listedAt,
    });
  },
});

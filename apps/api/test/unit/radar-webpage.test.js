import { describe, expect, it } from "vitest";
import { disallowed, jobLinks, jobPostingsIn, webpage } from "../../src/radar/webpage.ts";

// Boards without an API, read from their public job pages: only with permission, obeying robots.txt, from each page's
// schema.org JobPosting data. A made-up board here (no real site is read in tests).

const SITE = "https://board.example";
const posting = (id, extra = {}) => ({
  "@context": "https://schema.org", "@type": "JobPosting", title: `Junior Accountant ${id}`, identifier: { "@type": "PropertyValue", value: `J-${id}` },
  description: "<p>Prepare <b>monthly</b> reports in Excel.</p>", datePosted: "2026-10-01", validThrough: "2026-11-01T00:00:00Z", employmentType: ["FULL_TIME"],
  hiringOrganization: { "@type": "Organization", name: "Cedar Accounting" }, jobLocation: { "@type": "Place", address: { addressLocality: "Beirut", addressCountry: "LB" } },
  baseSalary: { "@type": "MonetaryAmount", currency: "USD", value: { "@type": "QuantitativeValue", minValue: 800, maxValue: 1200, unitText: "MONTH" } }, ...extra,
});
const page = (data) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body>…</body></html>`;
const LIST = `<a href="/job/1">1</a><a href="/job/2?ref=list">2</a><a href="/job/1">again</a><a href="/private/job/3">3</a><a href="https://other.example/job/9">other site</a><a href="/about">about</a>`;
const ROBOTS = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nDisallow: /*?ref=\n";
const site = (pages) => {
  const asked = [];
  const text = async (url) => {
    asked.push(url);
    if (url in pages) return pages[url];
    throw new Error(`${url} answered 404`);
  };
  return { text, asked };
};
const pages = { [`${SITE}/robots.txt`]: ROBOTS, [`${SITE}/jobs`]: LIST, [`${SITE}/job/1`]: page(posting(1)), [`${SITE}/job/2?ref=list`]: page(posting(2)) };
const config = { listUrl: `${SITE}/jobs`, linkPattern: "^/(private/)?job/", board: "Example Board", permission: "Allowed by Rana (board manager) by email, 2026-10-04" };

describe("reading a job board's public pages", () => {
  it("robots.txt: the rules for every robot (and ours), not another robot's", () => {
    expect(disallowed(ROBOTS)).toEqual(["/private/", "/*?ref="]);
    expect(disallowed("User-agent: *\nDisallow:\n")).toEqual([]);
  });

  it("job links: same site, matching, absolute, once each", () => {
    expect(jobLinks(LIST, `${SITE}/jobs`, "^/(private/)?job/")).toEqual([`${SITE}/job/1`, `${SITE}/job/2?ref=list`, `${SITE}/private/job/3`]);
  });

  it("job data: JobPosting found directly, in @graph, or in a list; broken blocks skipped", () => {
    expect(jobPostingsIn(page(posting(1)))).toHaveLength(1);
    expect(jobPostingsIn(page({ "@graph": [{ "@type": "WebPage" }, posting(2)] }))).toHaveLength(1);
    expect(jobPostingsIn(`${page([posting(3)])}<script type="application/ld+json">{broken</script>`)).toHaveLength(1);
    expect(jobPostingsIn("<p>no data</p>")).toEqual([]);
  });

  it("without a recorded permission nothing is read at all", async () => {
    const { text, asked } = site(pages);
    await expect(webpage(0).fetchPage({ ...config, permission: "" }, null, null, text)).rejects.toThrow(/no written permission/);
    expect(asked).toEqual([]);
  });

  it("with permission: obeys robots.txt (skips /private/ and ?ref= pages) and turns each page into a posting", async () => {
    const { text, asked } = site(pages);
    const a = webpage(0);
    const got = await a.fetchPage(config, null, null, text);
    expect(asked).toEqual([`${SITE}/robots.txt`, `${SITE}/jobs`, `${SITE}/job/1`]); // not /private/job/3, not ?ref=
    expect(got.next).toBeNull();
    expect(a.normalise(got.items[0], config)).toMatchObject({
      externalId: "J-1", url: `${SITE}/job/1`, title: "Junior Accountant 1", company: "Cedar Accounting",
      description: "Prepare monthly reports in Excel.", locationText: "Beirut, LB", countryCode: "LB", employmentHint: "full time",
      closesAt: new Date("2026-11-01T00:00:00Z"), salary: { min: 800, max: 1200, currency: "USD", period: "month" },
    });
  });

  it("a listing page robots.txt forbids is not read", async () => {
    const { text } = site({ ...pages, [`${SITE}/robots.txt`]: "User-agent: *\nDisallow: /jobs\n" });
    await expect(webpage(0).fetchPage(config, null, null, text)).rejects.toThrow(/robots.txt/);
  });
});

import type { Adapter } from "./adapters.ts";
import { JobPostingDTO } from "./dto.ts";
import { htmlToText } from "./text.ts";

// Job boards without an API (P6-01/02, for example Lebanese boards): their public job pages, read the polite way.
//   - Only with permission: a source is read only when its `permission` setting records who allowed it and when
//     (docs/job-sources.md). Several boards' terms forbid automated reading without it; this is how we respect that.
//   - robots.txt is obeyed, one page every 2 seconds at most, at most PER_PAGE job pages per round, a name that says
//     who we are.
//   - Each job page is read from its schema.org JobPosting data (the JSON-LD job sites publish for search engines),
//     not by guessing at the page's layout, so a redesign doesn't turn into nonsense; a page without it is skipped.
//   - We keep the facts and a short description, name the board, and link every posting to its original page.
// Settings: `listUrl` (a public page that links to the jobs), `linkPattern` (which links are job pages), `permission`.

export type HttpText = (url: string) => Promise<string>;

export const USER_AGENT = "Hyperfocus Job Radar (job search for students; contact: see https://github.com/hyperfocus)";
const PER_PAGE = 10;
const GAP_MS = 2000;
const KEEP_CHARS = 1500; // the description kept: enough to match on and decide, the rest is on the board's page

export const httpText: HttpText = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.text();
};

/** The paths robots.txt keeps every robot ("*") and us out of. */
export function disallowed(robots: string): string[] {
  const out: string[] = [];
  let applies = false;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, field = "", value = ""] = m;
    if (field.toLowerCase() === "user-agent") {
      const mine = value === "*" || /hyperfocus/i.test(value);
      applies = lastWasAgent ? applies || mine : mine;
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (applies && field.toLowerCase() === "disallow" && value) out.push(value);
  }
  return out;
}
const blocked = (rules: string[], url: URL) => {
  const path = url.pathname + url.search;
  return rules.some((r) => {
    const re = new RegExp(`^${r.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*").replace(/\\\$$/, "$")}`);
    return re.test(path);
  });
};

/** The schema.org JobPosting objects in a page's JSON-LD (also inside @graph or lists). */
export function jobPostingsIn(html: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const type = o["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) found.push(o);
    if (o["@graph"]) visit(o["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1] ?? ""));
    } catch {
      /* a broken block: skipped */
    }
  }
  return found;
}

/** The job page links on a listing page, absolute, same site, in order, once each. */
export function jobLinks(html: string, base: string, pattern: string): string[] {
  const re = new RegExp(pattern);
  const host = new URL(base).host;
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL((m[1] ?? "").replace(/&amp;/g, "&"), base);
      if (u.host === host && re.test(u.pathname + u.search)) out.add(u.toString());
    } catch {
      /* not a link */
    }
  }
  return [...out];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : Array.isArray(v) && v[0] && typeof v[0] === "object" ? (v[0] as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const date = (v: unknown) => {
  const d = new Date(str(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const UNITS: Record<string, "year" | "month" | "hour"> = { YEAR: "year", MONTH: "month", HOUR: "hour" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const webpage = (gapMs = GAP_MS): Adapter => ({
  kind: "webpage",
  label: "the board's website",
  everyMinutes: 360,
  async fetchPage(config, cursor, _http, text = httpText) {
    if (!config["permission"]?.trim()) throw new Error("Not read: no written permission recorded for this board (Admin → Job sources; docs/job-sources.md).");
    const listUrl = config["listUrl"] ?? "";
    const pattern = config["linkPattern"] ?? "";
    if (!/^https:\/\//.test(listUrl) || !pattern) throw new Error("This source needs a listUrl (https) and a linkPattern.");
    const robots = disallowed(await text(new URL("/robots.txt", listUrl).toString()).catch(() => ""));
    if (blocked(robots, new URL(listUrl))) throw new Error("robots.txt asks robots not to read this listing page.");
    const offset = Number(cursor ?? 0) || 0;
    const links = jobLinks(await text(listUrl), listUrl, pattern).filter((u) => !blocked(robots, new URL(u)));
    const items: Obj[] = [];
    for (const url of links.slice(offset, offset + PER_PAGE)) {
      await sleep(gapMs);
      const posting = jobPostingsIn(await text(url))[0];
      if (posting) items.push({ ...posting, "@page": url });
    }
    return { items, next: offset + PER_PAGE < links.length ? String(offset + PER_PAGE) : null };
  },
  normalise(item, config) {
    const j = obj(item);
    const page = str(j["@page"]);
    const org = obj(j["hiringOrganization"]);
    const place = obj(obj(j["jobLocation"])["address"]);
    const pay = obj(j["baseSalary"]);
    const amount = obj(pay["value"]);
    const country = str(place["addressCountry"]) || str(obj(place["addressCountry"])["name"]);
    const min = Number(amount["minValue"] ?? amount["value"]) || null;
    const max = Number(amount["maxValue"]) || null;
    return JobPostingDTO.parse({
      externalId: str(obj(j["identifier"])["value"]) || str(j["identifier"]) || page,
      url: str(j["url"]) || page,
      title: htmlToText(str(j["title"])),
      company: str(org["name"]) || config["board"] || "",
      description: htmlToText(str(j["description"])).slice(0, KEEP_CHARS),
      locationText: [str(place["addressLocality"]), str(place["addressRegion"]), country].filter(Boolean).join(", "),
      countryCode: /^[A-Z]{2}$/i.test(country) ? country : null,
      remote: str(j["jobLocationType"]).toUpperCase() === "TELECOMMUTE" ? true : null,
      employmentHint: (Array.isArray(j["employmentType"]) ? (j["employmentType"] as unknown[]).map(str).join(", ") : str(j["employmentType"])).replace(/_/g, " ").toLowerCase(),
      tags: [],
      postedAt: date(j["datePosted"]) ?? new Date(),
      closesAt: date(j["validThrough"]),
      salary: min || max ? { min, max, currency: str(pay["currency"]).slice(0, 3), period: UNITS[str(amount["unitText"]).toUpperCase()] ?? "" } : null,
    });
  },
});

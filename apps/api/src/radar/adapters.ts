import { JobPostingDTO } from "./dto.ts";
import { htmlToText } from "./text.ts";

// One adapter per source (P6-12, the anti-corruption layer): it knows how to ask the source for a page of postings and
// how to turn each of its items into a JobPostingDTO. Nothing else in Job Radar knows a source's own field names.
// Launch sources, all free and without a key (docs/job-sources.md): Arbeitnow, Greenhouse boards, Lever boards.
// `base` replaces the source's address only in tests.

export type Page = { items: unknown[]; next: string | null };
export type Adapter = {
  kind: string;
  /** a name people see: "via Arbeitnow" */
  label: string;
  /** how often it may be asked (their terms, docs/job-sources.md) */
  everyMinutes: number;
  fetchPage(config: Record<string, string>, cursor: string | null, http: Http): Promise<Page>;
  normalise(item: unknown, config: Record<string, string>): JobPostingDTO;
};
export type Http = (url: string) => Promise<unknown>;

/** A plain GET for JSON, naming Hyperfocus, with a time limit. */
export const httpJson: Http = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "Hyperfocus Job Radar (https://github.com/hyperfocus)", Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.json();
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const board = (config: Record<string, string>) => {
  const b = config["board"] ?? "";
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/i.test(b)) throw new Error(`Not a board name: ${b}`);
  return b;
};

export const arbeitnow: Adapter = {
  kind: "arbeitnow",
  label: "Arbeitnow",
  everyMinutes: 120,
  async fetchPage(config, cursor, http) {
    const url = cursor ?? `${config["base"] || "https://www.arbeitnow.com"}/api/job-board-api`;
    const j = obj(await http(url));
    const next = str(obj(j["links"])["next"]) || null;
    return { items: arr(j["data"]), next };
  },
  normalise(item) {
    const j = obj(item);
    return JobPostingDTO.parse({
      externalId: str(j["slug"]),
      url: str(j["url"]),
      title: str(j["title"]),
      company: str(j["company_name"]),
      description: htmlToText(str(j["description"])),
      locationText: str(j["location"]),
      remote: typeof j["remote"] === "boolean" ? j["remote"] : null,
      employmentHint: arr(j["job_types"]).map(str).join(", "),
      tags: arr(j["tags"]).map(str),
      postedAt: new Date(Number(j["created_at"]) * 1000),
    });
  },
};

export const greenhouse: Adapter = {
  kind: "greenhouse",
  label: "Greenhouse",
  everyMinutes: 180,
  async fetchPage(config) {
    // one page per board: the board answers everything at once
    const j = obj(await httpJson(`${config["base"] || "https://boards-api.greenhouse.io"}/v1/boards/${board(config)}/jobs?content=true`));
    return { items: arr(j["jobs"]), next: null };
  },
  normalise(item, config) {
    const j = obj(item);
    return JobPostingDTO.parse({
      externalId: str(j["id"]),
      url: str(j["absolute_url"]),
      title: str(j["title"]),
      company: str(j["company_name"]) || config["company"] || config["board"] || "",
      description: htmlToText(str(j["content"])),
      locationText: str(obj(j["location"])["name"]),
      employmentHint: arr(j["metadata"]).map((m) => `${str(obj(m)["name"])}: ${str(obj(m)["value"])}`).filter((s) => /employment|type|time/i.test(s)).join(", "),
      postedAt: new Date(str(j["first_published"]) || str(j["updated_at"])),
      closesAt: str(j["application_deadline"]) ? new Date(str(j["application_deadline"])) : null,
    });
  },
};

export const lever: Adapter = {
  kind: "lever",
  label: "Lever",
  everyMinutes: 180,
  async fetchPage(config) {
    return { items: arr(await httpJson(`${config["base"] || "https://api.lever.co"}/v0/postings/${board(config)}?mode=json`)), next: null };
  },
  normalise(item, config) {
    const j = obj(item);
    const cat = obj(j["categories"]);
    const range = obj(j["salaryRange"]);
    const interval = str(range["interval"]).toLowerCase();
    return JobPostingDTO.parse({
      externalId: str(j["id"]),
      url: str(j["hostedUrl"]),
      title: str(j["text"]),
      company: config["company"] || config["board"] || "",
      description: [str(j["descriptionPlain"]), ...arr(j["lists"]).map((l) => `${str(obj(l)["text"])}\n${htmlToText(str(obj(l)["content"]))}`), str(j["additionalPlain"])].filter(Boolean).join("\n\n"),
      locationText: arr(cat["allLocations"]).map(str).join("; ") || str(cat["location"]),
      countryCode: /^[A-Z]{2}$/.test(str(j["country"])) ? str(j["country"]) : null,
      workModeHint: str(j["workplaceType"]),
      employmentHint: str(cat["commitment"]),
      tags: [str(cat["team"]), str(cat["department"])].filter(Boolean),
      postedAt: new Date(Number(j["createdAt"])),
      salary: range["min"] || range["max"]
        ? { min: Number(range["min"]) || null, max: Number(range["max"]) || null, currency: str(range["currency"]).slice(0, 3), period: interval.includes("hour") ? "hour" : interval.includes("month") ? "month" : interval.includes("year") ? "year" : "" }
        : null,
    });
  },
};

export const ADAPTERS: Record<string, Adapter> = { arbeitnow, greenhouse, lever };

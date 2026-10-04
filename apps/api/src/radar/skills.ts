// The skill extractor (P6-14): which standard skills a posting asks for. Every label of every taxonomy skill is put in
// one Aho–Corasick automaton, so a posting is read once whatever the number of skills (~9,000 in O*NET, ~14,000 more
// with ESCO). Precision over recall: a word only counts as a whole word; a label that is also an everyday English word
// ("Access", "Word", "Teams", "Go", "Swift"…) or very short counts only when written as a name (with its capitals);
// O*NET's broad one-word abilities ("Writing", "Speaking") aren't looked for at all. Tools also get the names people
// write: "Microsoft Excel" → "Excel", "Structured query language SQL" → "SQL", "… software" without "software".
// Measured on 200 real postings (scripts/measure-skills.ts), which led to these rules too: an acronym with several
// meanings counts only for the one O*NET marks as in demand; a rarer acronym only when a word of its full name is also
// there ("PMP" isn't "Pathogen Modeling Program" in a project manager's ad); a one-word tool not as a possessive
// ("Maya's awards"); a "… software" category not when a company describes itself ("our operating system"); nothing in
// "follow us on LinkedIn, Instagram" lines.

export type SkillLabel = { id: number; type: string; name: string; altLabels: string[]; hot?: boolean };
/** exact: the capitals it must have; acronym: the words of its full name (a rare acronym needs one of them nearby);
 * category: a "… software" category written without "software"; oneWord: a one-word name */
type Pattern = { skillId: number; exact: string | null; acronym?: string[]; category?: boolean; oneWord?: boolean; confirmed?: boolean };

/** Everyday words that are also product names: only counted when written like the name. */
const EVERYDAY = new Set("access word teams excel box slack zoom notes project visio spark swift ruby rust go make ant chef puppet salt jenkins dart julia elixir flask express ember backbone meteor gatsby next nuxt redux vue react angular svelte docker kubernetes git jira confluence trello asana monday notion figma sketch canva outlook office windows linux unix mac android ios safari chrome edge opera firefox drive sheets docs forms keynote pages numbers photos maps meet chat mail calendar contacts reminders shortcuts terminal console shell bash power automate dynamics business central navision sage xero quickbooks freshbooks wave square stripe paypal shopify magento wordpress drupal joomla wix squarespace hubspot marketo pardot mailchimp hootsuite buffer sprout later loomly bitly tableau looker domo qlik alteryx knime orange weka sas stata spss minitab matlab mathematica maple".split(" "));
/** "Tools" that are only a company's name, or an everyday verb: in an ad they almost never mean the tool. */
const NOT_ALONE = new Set(["google", "microsoft", "amazon", "apple", "oracle", "ibm", "adobe", "meta", "analyze"]);
/** "… software" categories whose short name is mostly a company describing itself ("our operating system", "cash flow
 * is the fuel"): only counted with "software". */
const CATEGORY_FULL_ONLY = new Set(["operating system", "cash flow", "shipping", "remote control", "remote monitoring", "financial modeling", "business management", "control system", "records management", "data management"]);
/** The short names people write that the dataset's own names don't give ("Microsoft .NET Framework" is written ".NET"). */
const ALIASES: Record<string, string[]> = { "microsoft .net framework": [".NET"], "javascript object notation json": ["JSON"] };
/** Acronyms everyone in the field writes for one thing: they count alone (when only one skill has them). */
const KNOWN_ACRONYMS = new Set(["CRM", "ERP", "CAD", "DNS", "DHCP", "VPN", "LAN", "WAN", "SEO", "SEM", "GPS", "PLC", "CNC", "SPC", "MES", "LIMS", "HRIS", "BIM", "GIS", "CMS", "LMS", "ATS", "ETL", "SCADA"]);
/** Words too common to show that a rare acronym means this product ("ATS" + "system" isn't "Automated Targeting System"). */
const GENERIC = new Set(["system", "systems", "software", "management", "program", "language", "analysis", "automated", "service", "services", "application", "network", "control", "computer", "information", "digital"]);
/** O*NET's knowledge areas ("Education and Training") read like ordinary phrases in ads: not looked for. */
const SKIP_TYPES = new Set(["knowledge"]);
/** Short names that are real technologies (any other name of 3 characters or less is too ambiguous: "AI", "PC", "US"). */
const SHORT_TECH = new Set(["SQL", "AWS", "PHP", "CSS", "SAS", "SAP", "Git", "Vue", "C++", "C#", ".NET", "GCP", "ROS", "SPSS", "HTML", "JSON", "XML", "Java", "Ruby", "Rust", "Perl", "Bash", "Jira"]);
const shortTech = (label: string) => SHORT_TECH.has(label) || [...SHORT_TECH].some((t) => t.toLowerCase() === label.toLowerCase());
/** Tools people name without their maker: "Microsoft Excel" is written "Excel". Only these (others are ordinary words: Adobe "Connect"). */
const WITHOUT_VENDOR = new Set(["excel", "powerpoint", "outlook", "sharepoint", "azure", "java", "photoshop", "illustrator", "indesign", "premiere pro", "after effects", "lightroom", "dreamweaver", "autocad", "revit", "maya", "3ds max", "power bi", "visual studio", "sql server", "jira", "confluence", "bigquery", "tensorflow", "salesforce", "dynamics 365", "xd", "firebase", "kubernetes engine", "android", "ios", "macos"]);
const VENDORS = /^(microsoft|oracle|amazon|google|adobe|ibm|sap|apple|autodesk|atlassian|salesforce|the mathworks|mathworks)\s+/i;
const initials = (words: string[]) => words.map((w) => w[0]?.toUpperCase() ?? "").join("");
/** Business and place codes that are also product acronyms ("SEA" in an ad means South-East Asia). */
const COMMON_CODES = new Set(["SEA", "APAC", "EMEA", "LATAM", "CEO", "CFO", "CTO", "COO", "CRO", "CMO", "KPI", "OKR", "ROI", "USA", "NYC", "B2B", "B2C", "HR", "PR", "QA", "UX", "UI", "IT", "AI", "ML", "PC", "US", "UK", "EU"]);
/** A name that isn't an ordinary word: an inner capital or a digit or a dot (GitLab, PostgreSQL, Node.js, S3). */
const nameLike = (w: string) => /[a-z][A-Z]|\d|\./.test(w);

/** The labels to look for, and how (exactly as written, or any case). */
export function patternsFor(skills: SkillLabel[]): Map<string, Pattern[]> {
  const out = new Map<string, Pattern[]>();
  const acronyms = new Set<string>();
  const add = (label: string, skillId: number, caseSensitive: boolean, more: Omit<Pattern, "skillId" | "exact"> = {}) => {
    const text = label.trim().replace(/\s+/g, " ");
    if (text.length < 2) return;
    const key = text.toLowerCase();
    const list = out.get(key) ?? [];
    if (!list.some((p) => p.skillId === skillId)) list.push({ skillId, exact: caseSensitive ? text : null, ...(text.includes(" ") ? {} : { oneWord: true }), ...more });
    out.set(key, list);
  };
  for (const s of skills) {
    if (SKIP_TYPES.has(s.type) || NOT_ALONE.has(s.name.trim().toLowerCase())) continue;
    for (const raw of [s.name, ...s.altLabels]) {
      const label = raw.trim();
      const words = label.split(/\s+/);
      const one = words.length === 1;
      // O*NET's broad abilities: only phrases ("Critical Thinking"), never one word ("Writing")
      if (s.type === "skill" && one && !s.altLabels.includes(raw)) continue;
      if (one && label.replace(/[^\p{L}\p{N}]/gu, "").length <= 3 && !shortTech(label)) continue;
      const caps = one && label.length >= 2 && label === label.toUpperCase() && /[A-Z]/.test(label);
      // one-word product names are proper names: matched with their capitals, unless they can't be an ordinary word
      const oneWordTool = one && s.type === "tool" && !nameLike(label);
      // (short tech names like sql, git, aws: any case; they aren't ordinary words)
      const short = one && label.length <= 4 && shortTech(label);
      add(label, s.id, one && !short && (EVERYDAY.has(label.toLowerCase()) || caps || oneWordTool));
      if (s.type !== "tool") continue;
      // the names people actually write for a tool
      const noSoftware = label.replace(/\s+software$/i, "");
      if (noSoftware !== label && noSoftware.split(/\s+/).length >= 2 && !CATEGORY_FULL_ONLY.has(noSoftware.toLowerCase())) add(noSoftware, s.id, false, { category: true }); // "version control", never "Sales"
      // a product listed as "… software" ("Shopify software"): its name, written as a name
      if (noSoftware !== label && !noSoftware.includes(" ") && EVERYDAY.has(noSoftware.toLowerCase())) add(noSoftware, s.id, true);
      for (const alias of ALIASES[label.toLowerCase()] ?? []) add(alias, s.id, true);
      const noVendor = noSoftware.replace(VENDORS, "");
      if (noVendor !== noSoftware && WITHOUT_VENDOR.has(noVendor.toLowerCase())) add(noVendor, s.id, true);
      // an acronym at the end that its own words spell out: "Structured query language SQL" → SQL (not "Deacom ERP")
      const m = /^(.+)\s+([A-Z][A-Z0-9]{1,7})$/.exec(noSoftware);
      if (m?.[1] && m[2] && m[2].length >= 3 && !COMMON_CODES.has(m[2]) && initials(m[1].split(/\s+/).filter((w) => !/^(of|for|and|the|a|an|in|on|to)$/i.test(w))) === m[2]) {
        add(m[2], s.id, true, { acronym: m[1].toLowerCase().split(/\s+/).filter((w) => w.length >= 5 && !GENERIC.has(w)), ...(KNOWN_ACRONYMS.has(m[2]) ? { confirmed: true } : {}) });
        acronyms.add(m[2].toLowerCase());
      }
    }
  }
  // an acronym that stands for several skills: the same one written twice ("Structured" / "Structure query language")
  // counts once, otherwise only the meaning in demand counts, and with none in demand the acronym alone isn't enough
  const hot = new Set(skills.filter((x) => x.hot).map((x) => x.id));
  const nameOf = new Map(skills.map((x) => [x.id, x.name.toLowerCase().replace(/[^a-z]/g, "")]));
  const close = (a = "", b = "") => a.length === b.length ? [...a].filter((c, i) => c !== b[i]).length <= 2 : Math.abs(a.length - b.length) <= 2 && (a.startsWith(b.slice(0, -2)) || b.startsWith(a.slice(0, -2)));
  for (const key of acronyms) {
    const list = (out.get(key) ?? []).filter((p) => p.acronym);
    if (list.length < 2) continue;
    const kept = list.filter((p, i) => !list.slice(0, i).some((q) => close(nameOf.get(q.skillId), nameOf.get(p.skillId))));
    const chosen = kept.length === 1 ? kept : kept.filter((p) => hot.has(p.skillId));
    const others = (out.get(key) ?? []).filter((p) => !p.acronym);
    if (chosen.length + others.length) out.set(key, [...others, ...chosen.map((p) => ({ ...p, acronym: [], confirmed: true }))]);
    else out.delete(key);
  }
  // an acronym in demand (SQL, AWS, CRM…) needs nothing more
  for (const list of out.values()) for (const p of list) if (p.acronym?.length && hot.has(p.skillId)) p.acronym = [];
  return out;
}

type Node = { next: Map<string, number>; fail: number; out: string[] };

/** Aho–Corasick over lower-case text: every pattern found, in one pass. */
export class Automaton {
  private nodes: Node[] = [{ next: new Map(), fail: 0, out: [] }];
  constructor(keys: Iterable<string>) {
    for (const key of keys) {
      let n = 0;
      for (const ch of key) {
        let to = this.nodes[n]?.next.get(ch);
        if (to === undefined) {
          to = this.nodes.length;
          this.nodes.push({ next: new Map(), fail: 0, out: [] });
          this.nodes[n]?.next.set(ch, to);
        }
        n = to;
      }
      this.nodes[n]?.out.push(key);
    }
    // failure links, breadth first
    const queue: number[] = [];
    for (const to of this.nodes[0]?.next.values() ?? []) queue.push(to);
    while (queue.length) {
      const r = queue.shift() as number;
      for (const [ch, s] of this.nodes[r]?.next ?? []) {
        queue.push(s);
        let f = this.nodes[r]?.fail ?? 0;
        while (f && !this.nodes[f]?.next.has(ch)) f = this.nodes[f]?.fail ?? 0;
        const target = this.nodes[f]?.next.get(ch);
        const fail = target !== undefined && target !== s ? target : 0;
        const node = this.nodes[s] as Node;
        node.fail = fail;
        node.out.push(...(this.nodes[fail]?.out ?? []));
      }
    }
  }
  /** Every [start, end) where a key occurs in `text` (which must be lower case, the same length as the original). */
  *search(text: string): Generator<{ key: string; start: number; end: number }> {
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i] as string;
      while (n && !this.nodes[n]?.next.has(ch)) n = this.nodes[n]?.fail ?? 0;
      n = this.nodes[n]?.next.get(ch) ?? 0;
      for (const key of this.nodes[n]?.out ?? []) yield { key, start: i + 1 - key.length, end: i + 1 };
    }
  }
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

export type Extractor = {
  /** the skills a text asks for; `company`: a skill named like the employer isn't one ("GitLab" in GitLab's own ads) */
  find(text: string, company?: string): number[];
};

/** An extractor for these skills. */
export function makeExtractor(skills: SkillLabel[]): Extractor {
  const patterns = patternsFor(skills);
  const automaton = new Automaton(patterns.keys());
  const names = new Map(skills.map((s) => [s.id, s.name.toLowerCase()]));
  const hotIds = new Set(skills.filter((s) => s.hot).map((s) => s.id));
  return {
    find(text, company = "") {
      // (lower-casing keeps the length for these scripts; a character that changes length is replaced by a space)
      const lower = [...text].map((c) => (c.toLowerCase().length === c.length ? c.toLowerCase() : " ")).join("");
      const original = [...text].map((c) => (c.toLowerCase().length === c.length ? c : " ")).join("");
      const found = new Set<number>();
      for (const { key, start, end } of automaton.search(lower)) {
        // whole words only ("Java" isn't in "JavaScript"; "C++" ends with "+", so look at the label's own last char)
        const first = key[0] as string;
        const last = key[key.length - 1] as string;
        if (isWordChar(first) && isWordChar(lower[start - 1])) continue;
        if (isWordChar(last) && isWordChar(lower[end])) continue;
        // the sentence it is in: "follow us on LinkedIn, Instagram" lines name no skill
        const from = Math.max(lower.lastIndexOf("\n", start), lower.lastIndexOf(". ", start)) + 1;
        const to = [lower.indexOf("\n", end), lower.indexOf(". ", end)].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b), lower.length);
        const sentence = lower.slice(from, to);
        // nor do lists of the company's customers, partners and integrations ("companies like Figma", "trusted by")
        if (/\b(follow us|life at|discover more|find us on|join us on|about life|on our blog|companies like|customers (include|like)|brands including|integrations with|trusted by|used by|github stars|working closely with|creators across)\b/.test(sentence)) continue;
        const before = lower.slice(Math.max(0, start - 6), start);
        const after = lower.slice(end, end + 2);
        for (const p of patterns.get(key) ?? []) {
          if (p.exact && original.slice(start, end) !== p.exact) continue;
          if (p.oneWord && /^['’]s/.test(after)) continue; // "Maya's Culture 100": a name, not the tool
          if (p.category && /\b(our|the|an?)\s$/.test(before)) continue; // "our operating system": the company itself
          if (p.acronym && !p.acronym.length && !hotIds.has(p.skillId) && !p.confirmed) continue; // nothing telling to confirm it
          if (p.acronym?.length && !p.confirmed && !hotIds.has(p.skillId) && !p.acronym.some((w) => lower.includes(w))) continue; // "PMP" alone isn't a pathogen model
          if (p.oneWord && /^ de /.test(lower.slice(end, end + 4))) continue; // French "Chef de projet"
          found.add(p.skillId);
        }
      }
      const employer = company.trim().toLowerCase();
      return [...found].filter((id) => !employer || names.get(id) !== employer);
    },
  };
}

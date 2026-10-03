// The skill extractor (P6-14): which standard skills a posting asks for. Every label of every taxonomy skill is put in
// one Aho–Corasick automaton, so a posting is read once whatever the number of skills (~9,000 in O*NET, ~14,000 more
// with ESCO). Precision over recall: a word only counts as a whole word; a label that is also an everyday English word
// ("Access", "Word", "Teams", "Go", "Swift"…) or very short counts only when written as a name (with its capitals);
// O*NET's broad one-word abilities ("Writing", "Speaking") aren't looked for at all. Tools also get the names people
// write: "Microsoft Excel" → "Excel", "Structured query language SQL" → "SQL", "… software" without "software".

export type SkillLabel = { id: number; type: string; name: string; altLabels: string[] };
type Pattern = { skillId: number; exact: string | null };

/** Everyday words that are also product names: only counted when written like the name. */
const EVERYDAY = new Set("access word teams excel box slack zoom notes project visio spark swift ruby rust go make ant chef puppet salt jenkins dart julia elixir flask express ember backbone meteor gatsby next nuxt redux vue react angular svelte docker kubernetes git jira confluence trello asana monday notion figma sketch canva outlook office windows linux unix mac android ios safari chrome edge opera firefox drive sheets docs forms keynote pages numbers photos maps meet chat mail calendar contacts reminders shortcuts terminal console shell bash power automate dynamics business central navision sage xero quickbooks freshbooks wave square stripe paypal shopify magento wordpress drupal joomla wix squarespace hubspot marketo pardot mailchimp hootsuite buffer sprout later loomly bitly tableau looker domo qlik alteryx knime orange weka sas stata spss minitab matlab mathematica maple".split(" "));
/** O*NET's knowledge areas ("Education and Training") read like ordinary phrases in ads: not looked for. */
const SKIP_TYPES = new Set(["knowledge"]);
/** Short names that are real technologies (any other name of 3 characters or less is too ambiguous: "AI", "PC", "US"). */
const SHORT_TECH = new Set(["SQL", "AWS", "PHP", "CSS", "SAS", "SAP", "Git", "Vue", "C++", "C#", ".NET", "GCP", "ROS", "SPSS", "HTML", "JSON", "XML", "Java", "Ruby", "Rust", "Perl", "Bash", "Jira"]);
const shortTech = (label: string) => SHORT_TECH.has(label) || [...SHORT_TECH].some((t) => t.toLowerCase() === label.toLowerCase());
/** Tools people name without their maker: "Microsoft Excel" is written "Excel". Only these (others are ordinary words: Adobe "Connect"). */
const WITHOUT_VENDOR = new Set(["excel", "powerpoint", "outlook", "sharepoint", "azure", "java", "photoshop", "illustrator", "indesign", "premiere pro", "after effects", "lightroom", "dreamweaver", "autocad", "revit", "maya", "3ds max", "power bi", "visual studio", "sql server", "jira", "confluence", "bigquery", "tensorflow", "salesforce", "dynamics 365", "analytics", "xd", "firebase", "kubernetes engine", "android", "ios", "macos"]);
const VENDORS = /^(microsoft|oracle|amazon|google|adobe|ibm|sap|apple|autodesk|atlassian|salesforce|the mathworks|mathworks)\s+/i;
const initials = (words: string[]) => words.map((w) => w[0]?.toUpperCase() ?? "").join("");
/** Business and place codes that are also product acronyms ("SEA" in an ad means South-East Asia). */
const COMMON_CODES = new Set(["SEA", "APAC", "EMEA", "LATAM", "CEO", "CFO", "CTO", "COO", "CRO", "CMO", "KPI", "OKR", "ROI", "USA", "NYC", "B2B", "B2C", "HR", "PR", "QA", "UX", "UI", "IT", "AI", "ML", "PC", "US", "UK", "EU"]);
/** A name that isn't an ordinary word: an inner capital or a digit or a dot (GitLab, PostgreSQL, Node.js, S3). */
const nameLike = (w: string) => /[a-z][A-Z]|\d|\./.test(w);

/** The labels to look for, and how (exactly as written, or any case). */
export function patternsFor(skills: SkillLabel[]): Map<string, Pattern[]> {
  const out = new Map<string, Pattern[]>();
  const add = (label: string, skillId: number, caseSensitive: boolean) => {
    const text = label.trim().replace(/\s+/g, " ");
    if (text.length < 2) return;
    const key = text.toLowerCase();
    const list = out.get(key) ?? [];
    if (!list.some((p) => p.skillId === skillId)) list.push({ skillId, exact: caseSensitive ? text : null });
    out.set(key, list);
  };
  for (const s of skills) {
    if (SKIP_TYPES.has(s.type)) continue;
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
      if (noSoftware !== label && noSoftware.split(/\s+/).length >= 2) add(noSoftware, s.id, false); // "version control", never "Sales"
      const noVendor = noSoftware.replace(VENDORS, "");
      if (noVendor !== noSoftware && WITHOUT_VENDOR.has(noVendor.toLowerCase())) add(noVendor, s.id, true);
      // an acronym at the end that its own words spell out: "Structured query language SQL" → SQL (not "Deacom ERP")
      const m = /^(.+)\s+([A-Z][A-Z0-9]{1,7})$/.exec(noSoftware);
      if (m?.[1] && m[2] && m[2].length >= 3 && !COMMON_CODES.has(m[2]) && initials(m[1].split(/\s+/).filter((w) => !/^(of|for|and|the|a|an|in|on|to)$/i.test(w))) === m[2]) add(m[2], s.id, true);
    }
  }
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
        for (const p of patterns.get(key) ?? []) if (!p.exact || original.slice(start, end) === p.exact) found.add(p.skillId);
      }
      const employer = company.trim().toLowerCase();
      return [...found].filter((id) => !employer || names.get(id) !== employer);
    },
  };
}

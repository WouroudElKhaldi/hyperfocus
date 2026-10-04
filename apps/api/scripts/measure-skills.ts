// pnpm --filter @hyperfocus/api measure:skills [hits|score]   (P6-14 acceptance: measured on 200 labelled postings)
// The real skill extractor, with the real taxonomy in your database, on 200 real postings (test/fixtures/skills-200.json:
// public Arbeitnow postings, 2026-10-04). Labels: test/fixtures/skills-200.labels.json, per posting, the skills it
// really asks for among those the taxonomy knows ("asks"), and the extractor's finds judged wrong ("wrong").
//   hits:  what the extractor finds in each posting, with the words around each find (for labelling)
//   score: precision (finds that are right) and recall (skills asked for that were found), against the labels
import fs from "node:fs";
import { PrismaClient } from "@hyperfocus/db";
import { makeExtractor } from "../src/radar/skills.ts";

type Posting = { slug: string; title: string; company: string; text: string };
type Label = { asks: string[]; wrong: string[] };
const dir = new URL("../test/fixtures/", import.meta.url);
const postings: Posting[] = JSON.parse(fs.readFileSync(new URL("skills-200.json", dir), "utf8"));
const mode = process.argv[2] ?? "score";

const db = new PrismaClient();
const skills = await db.taxonomySkill.findMany({ select: { id: true, type: true, name: true, altLabels: true, hot: true } });
await db.$disconnect();
const names = new Map(skills.map((s) => [s.id, s]));
const started = performance.now();
const extractor = makeExtractor(skills);
const found = postings.map((p) => [...new Set(extractor.find(`${p.title}\n${p.text}`, p.company).map((id) => names.get(id)?.name ?? "?"))]);
const ms = performance.now() - started;

if (mode === "hits") {
  // the words around a find: its name, or the shorter name people write (without "software", the maker, or as an acronym)
  const around = (text: string, name: string) => {
    const s = skills.find((x) => x.name === name);
    const bare = name.replace(/\s+software$/i, "");
    const acr = /\s([A-Z][A-Z0-9]{1,7})$/.exec(bare)?.[1];
    const labels = [name, ...(s?.altLabels ?? []), bare, bare.split(" ").slice(1).join(" "), acr ?? ""].filter((l) => l.length >= 2);
    const lower = text.toLowerCase();
    for (const l of labels) {
      const at = acr && l === acr ? text.search(new RegExp(`\\b${acr}\\b`)) : lower.indexOf(l.toLowerCase());
      if (at >= 0) return text.slice(Math.max(0, at - 50), at + 60).replace(/\s+/g, " ");
    }
    return "";
  };
  const out = postings.map((p, i) => ({ slug: p.slug, title: p.title, found: (found[i] ?? []).map((n) => ({ skill: n, where: around(`${p.title}\n${p.text}`, n) })) }));
  fs.writeFileSync(new URL("skills-200.hits.json", dir), JSON.stringify(out, null, 1));
  console.log(`${skills.length} skills, ${postings.length} postings, ${found.flat().length} finds in ${Math.round(ms)} ms → test/fixtures/skills-200.hits.json`);
} else {
  const labels: Record<string, Label> = JSON.parse(fs.readFileSync(new URL("skills-200.labels.json", dir), "utf8"));
  let right = 0, wrong = 0, asked = 0, caught = 0, labelled = 0;
  for (const [i, p] of postings.entries()) {
    const l = labels[p.slug];
    if (!l) continue;
    labelled++;
    const f = new Set(found[i]);
    const bad = new Set(l.wrong);
    for (const n of f) bad.has(n) ? wrong++ : right++;
    asked += l.asks.length;
    caught += l.asks.filter((n) => f.has(n)).length;
  }
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");
  console.log(`${labelled} labelled postings · finds: ${right + wrong} (${wrong} wrong) · precision ${pct(right, right + wrong)} · recall ${pct(caught, asked)} (${caught} of ${asked} skills asked for) · ${Math.round(ms)} ms for all`);
}

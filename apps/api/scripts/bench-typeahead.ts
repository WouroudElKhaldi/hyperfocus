// pnpm --filter @hyperfocus/api bench:typeahead   (P6-06 acceptance: typeahead under 50 ms at p95)
// Runs 300 searches through the whole API (middleware, route, query) against the database in .env, the way someone
// types: 2, 3, 4… letters of real words, a few with typos, across every kind.
import { OWNER_OMIT, PrismaClient } from "@hyperfocus/db";
import { pino } from "pino";
import { config } from "../src/config.ts";
import { createApp } from "../src/app.ts";
import { EventBus } from "../src/events.ts";
import { tenancy } from "../src/tenancy.ts";
import type { Db } from "../src/types.ts";

const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl, omit: OWNER_OMIT }).$extends(tenancy) as unknown as Db;
const none = () => { throw new Error("not used"); };
const app = createApp({
  config, prisma, log: pino({ level: "silent" }), events: new EventBus(() => {}),
  ai: { text: none, run: none } as never, publisher: { configured: () => false, publish: none } as never,
  mail: { status: () => ({ ready: false, user: "", hasKey: false, hasUser: false }), unavailable: () => null, send: none } as never,
});

const words: [string, string][] = [
  ["occupation", "software developer"], ["occupation", "nurse"], ["occupation", "data scientist"], ["occupation", "accountant"],
  ["occupation", "graphic designer"], ["occupation", "teacher"], ["occupation", "softwre enginer"], ["occupation", "marketing manager"],
  ["skill", "python"], ["skill", "project management"], ["skill", "javascript"], ["skill", "excel"], ["skill", "comunication"],
  ["field", "computer science"], ["field", "biology"], ["field", "psychology"], ["field", "mechanical engineering"],
  ["city", "beirut"], ["city", "london"], ["city", "san francisco"], ["country", "lebanon"], ["country", "germany"], ["industry", "health"],
];
const queries: string[] = [];
for (const [kind, w] of words) for (let n = 2; n <= Math.min(w.length, 14); n += 2) queries.push(`/api/taxonomy/search?kind=${kind}&q=${encodeURIComponent(w.slice(0, n))}`);
while (queries.length < 300) queries.push(...queries.slice(0, 300 - queries.length));

for (const q of queries.slice(0, 20)) await app.request(q); // (warm up)
const times: number[] = [];
let empty = 0;
for (const q of queries) {
  const t = performance.now();
  const r = await app.request(q);
  const body = (await r.json()) as { items: unknown[] };
  times.push(performance.now() - t);
  if (process.env.SLOW && performance.now() - t > 50) console.log(`slow ${(performance.now() - t).toFixed(0)} ms ${q}`);
  if (r.status !== 200) throw new Error(`${q} → ${r.status}`);
  if (!body.items.length) empty++;
}
times.sort((a, b) => a - b);
const p = (x: number) => times[Math.min(times.length - 1, Math.floor((x / 100) * times.length))]?.toFixed(1);
console.log(`${times.length} searches: p50 ${p(50)} ms, p95 ${p(95)} ms, p99 ${p(99)} ms, max ${times.at(-1)?.toFixed(1)} ms; ${empty} with no result`);
const show = async (q: string) => console.log(q, "→", ((await (await app.request(q)).json()) as { items: { label: string; detail: string }[] }).items.slice(0, 4).map((h) => `${h.label}${h.detail ? ` (${h.detail})` : ""}`).join(" | "));
await show("/api/taxonomy/search?kind=occupation&q=frontend");
await show("/api/taxonomy/search?kind=occupation&q=softwre%20enginer");
await show("/api/taxonomy/search?kind=skill&q=pyth");
await show("/api/taxonomy/search?kind=field&q=computer%20sci");
await show("/api/taxonomy/search?kind=city&q=beir");
await prisma.$disconnect();

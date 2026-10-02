// Lists every API route the server registers and checks a contract test calls it.
// Run: node test/support/route-coverage.mjs   (exits 1 if a route has no test)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
// every file under dir, sub-folders included (routes move into module folders as they are ported to Hono)
const read = (dir, ext) => fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => f.endsWith(ext)).map((f) => fs.readFileSync(path.join(root, dir, f), "utf8")).join("\n");

// The Hono routes come from the app itself (its route table), so routes built in code (like the CRUD factory's) count.
// Importing the API can check settings (src/config.ts), so give it a database address that is never opened.
process.env.DATABASE_URL ||= "file:./route-check-never-opened.db";
const { createApp } = await import("../../src/app.ts");
const { pino } = await import("pino");
const stubConfig = { deepseek: {}, gmail: {}, rateLimit: { perMinute: 1, aiPerMinute: 1 } };
const hono = createApp({ config: stubConfig, prisma: {}, log: pino({ level: "silent" }) });
const honoRoutes = hono.routes.filter((r) => r.method !== "ALL").map((r) => ({ method: r.method, path: r.path }));

const seen = new Set();
const routes = honoRoutes.filter((r) => !seen.has(`${r.method} ${r.path}`) && seen.add(`${r.method} ${r.path}`));

// every call in the tests, with ${...} expressions turned into a placeholder
const tests = read("test/contract", ".test.js");
const calls = [];
const alias = { get: "GET", post: "POST", put: "PUT", patch: "PATCH", del: "DELETE" };
for (const [, fn, , p] of tests.matchAll(/\b(get|post|put|patch|del)\(\s*([`"])(\/api[^`"]*)\2/g)) calls.push({ method: alias[fn], path: p });
for (const [, m, p] of tests.matchAll(/\bapi\(\s*"(\w+)",\s*[`"](\/api[^`"]*)[`"]/g)) calls.push({ method: m, path: p });
for (const [, p] of tests.matchAll(/upload\(\s*[`"](\/api[^`"]*)[`"]/g)) calls.push({ method: "POST", path: p });

const norm = (p) => p.replace(/\$\{[^}]+\}/g, "X").split("?")[0];
const toRe = (p) => new RegExp(`^${p.replace(/[.]/g, "\\.").replace(/:[A-Za-z]+/g, "[^/]+")}$`);

const missing = routes.filter((r) => !calls.some((c) => c.method === r.method && toRe(r.path).test(norm(c.path))));
console.log(`${routes.length - missing.length}/${routes.length} routes are called by a contract test.`);
for (const m of missing) console.log(`  missing: ${m.method} ${m.path}`);
process.exit(missing.length ? 1 : 0);

// Lists every API route the server registers and checks a contract test calls it.
// Run: node test/support/route-coverage.mjs   (exits 1 if a route has no test)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (dir, ext) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).map((f) => fs.readFileSync(path.join(root, dir, f), "utf8")).join("\n");

const routes = [...read("src", ".js").matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)].map(([, m, p]) => ({ method: m.toUpperCase(), path: p }));

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

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

// Prisma applies migrations in the order of their folder names as text, so "10_x" would run before "2_x" on a new
// database (found in P5-10). Folder names must sort in the order they were made: 0_ … 9_, then 9a_, 9b_ …

const dir = fileURLToPath(new URL("../../../../packages/db/prisma/migrations/", import.meta.url));

it("the migration folders sort as text in the order they were made", () => {
  const names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const order = (n) => { const m = /^(\d+)([a-z]*)_/.exec(n); return m ? [Number(m[1]), m[2]] : [Number.NaN, ""]; };
  const byMeaning = [...names].sort((a, b) => order(a)[0] - order(b)[0] || order(a)[1].localeCompare(order(b)[1]));
  expect([...names].sort()).toEqual(byMeaning);
  for (const n of names) expect(n, `${n} should start with a number`).toMatch(/^\d+[a-z]*_/);
});

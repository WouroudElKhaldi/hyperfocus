// Copies a Hyperfocus SQLite database into PostgreSQL (P4-03), then proves nothing was lost: every table's row count and
// a checksum of all its values must match on both sides, or the script says which table differs and exits with an error.
//   node scripts/sqlite-to-postgres.mjs <source.db> <postgresql://…?schema=…>
// The source is only read. The target must be empty: the script applies the migrations to it first and refuses to write
// into a table that already has rows. Run it on a copy of the data first (a backup), never straight on the live file.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../packages/db/src/index.ts";

const [source, target] = process.argv.slice(2);
if (!source || !target || !fs.existsSync(source)) {
  console.error("Use: node scripts/sqlite-to-postgres.mjs <source.db> <postgresql://user:pass@host:port/db?schema=name>");
  process.exit(1);
}

// 1. the target gets the same tables the app uses (the migrations), and must be empty
const DB_DIR = fileURLToPath(new URL("../packages/db/", import.meta.url));
execFileSync(process.execPath, [`${DB_DIR}node_modules/prisma/build/index.js`, "migrate", "deploy"], { cwd: DB_DIR, env: { ...process.env, DATABASE_URL: target }, stdio: "pipe" });
const pg = new PrismaClient({ datasourceUrl: target });
const schema = new URL(target).searchParams.get("schema") ?? "public";
const lite = new DatabaseSync(source, { readOnly: true });

const tables = lite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name").all().map((r) => r.name);

// the column types in PostgreSQL, to turn SQLite's values (dates as epoch ms, true/false as 1/0) into the right ones
const columns = {};
for (const r of await pg.$queryRawUnsafe(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = $1`, schema)) {
  (columns[r.table_name] ??= {})[r.column_name] = r.data_type;
}
for (const t of tables) if (!columns[t]) throw new Error(`Table ${t} is in the SQLite file but not in PostgreSQL: the migrations don't match this data.`);

// parents before children, so every foreign key finds its row
const fks = await pg.$queryRawUnsafe(
  `SELECT tc.table_name AS child, ccu.table_name AS parent FROM information_schema.table_constraints tc
   JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`, schema);
const order = [];
const visit = (t, seen = new Set()) => {
  if (order.includes(t) || seen.has(t)) return;
  seen.add(t);
  for (const f of fks) if (f.child === t && f.parent !== t) visit(f.parent, seen);
  order.push(t);
};
for (const t of tables) visit(t);

const toPg = (type, v) => {
  if (v === null || v === undefined) return null;
  if (type.startsWith("timestamp")) return new Date(Number(v));
  if (type === "boolean") return v === 1 || v === true || v === "1";
  if (type === "bytea") return Buffer.from(v);
  if (typeof v === "bigint") return Number(v);
  return v;
};

// 2. copy, in one transaction (all or nothing), with the session in UTC so dates are stored exactly as the app stores them
let copied = 0;
await pg.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'UTC'`);
  for (const t of order) {
    const [{ n }] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${schema}"."${t}"`);
    if (n > 0) throw new Error(`Table ${t} already has ${n} rows in the target. The target must be empty; nothing was written.`);
    const rows = lite.prepare(`SELECT * FROM "${t}"`).all();
    for (const row of rows) {
      // (P5-02/03) data from before accounts belongs to the owner account; the owner column has no usable default
      const r = columns[t].userId && !("userId" in row) ? { ...row, userId: "owner" } : row;
      const cols = Object.keys(r);
      const params = cols.map((c) => toPg(columns[t][c] ?? "text", r[c]));
      const marks = cols.map((c, i) => (columns[t][c]?.startsWith("timestamp") ? `$${i + 1}::timestamptz` : `$${i + 1}`));
      await tx.$executeRawUnsafe(`INSERT INTO "${schema}"."${t}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${marks.join(", ")})`, ...params);
      copied++;
    }
    // the next id the app makes continues after the copied ones
    if (columns[t].id === "integer" && rows.length)
      await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${schema}"."${t}"', 'id'), (SELECT max(id) FROM "${schema}"."${t}"))`);
  }
}, { timeout: 600_000 });

// 3. prove it: the same fingerprint on both sides (values normalised the same way: dates as epoch ms, true/false as 1/0)
const norm = (v) => (v instanceof Date ? v.getTime() : v instanceof Uint8Array ? `hex:${Buffer.from(v).toString("hex")}` : typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "bigint" ? Number(v) : v);
const fingerprint = (rows) => {
  const hash = createHash("sha256");
  for (const r of rows) hash.update(`${JSON.stringify(Object.keys(r).sort().map((k) => [k, norm(r[k])]))}\n`);
  return { rows: rows.length, sha256: hash.digest("hex").slice(0, 16) };
};
const keyOf = (t) => (columns[t].id ? "id" : Object.keys(columns[t]).sort()[0]);
let differ = 0;
console.log(`Copied ${copied} rows from ${source} into schema "${schema}".\n`);
for (const t of tables) {
  const a = fingerprint(lite.prepare(`SELECT * FROM "${t}" ORDER BY "${keyOf(t)}"`).all());
  const b = fingerprint(await pg.$queryRawUnsafe(`SELECT * FROM "${schema}"."${t}" ORDER BY "${keyOf(t)}"`));
  const same = a.rows === b.rows && a.sha256 === b.sha256;
  if (!same) differ++;
  console.log(`  ${same ? "✓" : "✗"} ${t.padEnd(18)} ${String(a.rows).padStart(6)} rows  ${a.sha256}${same ? "" : `  ≠ ${b.rows} rows ${b.sha256}`}`);
}
lite.close();
await pg.$disconnect();
console.log(differ ? `\n${differ} table(s) differ. Do not switch over.` : `\nEvery table matches: same rows, same values.`);
process.exit(differ ? 1 : 0);

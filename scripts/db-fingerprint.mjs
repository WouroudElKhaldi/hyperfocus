// Prints a fingerprint of a Hyperfocus SQLite database: the row count and a checksum of every table.
// Two databases with the same fingerprint hold exactly the same data. Used to prove backups and migrations lose nothing.
//   node scripts/db-fingerprint.mjs [path/to/file.db] [--json]
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? fileURLToPath(new URL("../server/prisma/dev.db", import.meta.url));
const db = new DatabaseSync(file, { readOnly: true });

// Values are normalised so the same data gives the same checksum in any database (dates as epoch ms, blobs as hex).
const norm = (v) => (v instanceof Uint8Array ? `hex:${Buffer.from(v).toString("hex")}` : typeof v === "bigint" ? Number(v) : v);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name").all().map((r) => r.name);
const out = {};
for (const t of tables) {
  const rows = db.prepare(`SELECT * FROM "${t}" ORDER BY 1`).all();
  const hash = createHash("sha256");
  for (const r of rows) hash.update(JSON.stringify(Object.keys(r).sort().map((k) => [k, norm(r[k])])) + "\n");
  out[t] = { rows: rows.length, sha256: hash.digest("hex").slice(0, 16) };
}
db.close();

if (args.includes("--json")) console.log(JSON.stringify({ file, tables: out }, null, 2));
else {
  console.log(`Fingerprint of ${file}`);
  for (const [t, v] of Object.entries(out)) console.log(`  ${t.padEnd(18)} ${String(v.rows).padStart(7)} rows  ${v.sha256}`);
}

import { Prisma } from "@hyperfocus/db";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { AttachmentFiles } from "../../storage/attachments.ts";
import type { Db } from "../../types.ts";

// "Export my data" (P4-08): everything you own as one zip you can keep or take elsewhere, and the way back in.
//   manifest.json            what this is, when, and how many rows per table
//   data/<Table>.json        every row, as readable JSON (dates as ISO text)
//   files/<id>-<name>        each email attachment's bytes (whichever storage they were in)
// The tables come from the schema itself, so a new table is exported without touching this file. Internal tables
// (the notification outbox) are not your data and are left out. Importing only goes into an empty database, so it never
// mixes with or overwrites anything.

export const FORMAT = "hyperfocus-export";
export const VERSION = 1;
// (the sign-in tables hold password hashes and session tokens: never exported; who you are travels with your account, P5-12)
const SKIP = new Set(["OutboxMessage", "User", "Session", "Account", "Verification", "FeatureFlag", "Integration", "AiUsage"]); // (and never anyone's tokens, P5-07) // (feature flags are for everyone, P5-06)

type Model = (typeof Prisma.dmmf.datamodel.models)[number];
const models = (): Model[] => Prisma.dmmf.datamodel.models.filter((m) => !SKIP.has(m.name));
type Delegate = { findMany(a?: object): Promise<Record<string, unknown>[]>; createMany(a: object): Promise<unknown>; count(): Promise<number> };
const delegate = (prisma: Db, model: string): Delegate => {
  const d = (prisma as unknown as Record<string, Delegate | undefined>)[model.charAt(0).toLowerCase() + model.slice(1)];
  if (!d) throw new Error(`No table ${model} in the database client.`);
  return d;
};
const safeName = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 80) || "file";

/** Parents before children, so every link finds its row on import. */
function inOrder(list: Model[]): Model[] {
  const byName = new Map(list.map((m) => [m.name, m]));
  const out: Model[] = [];
  const visit = (m: Model, seen = new Set<string>()) => {
    if (out.includes(m) || seen.has(m.name)) return;
    seen.add(m.name);
    for (const f of m.fields) if (f.relationFromFields?.length && f.type !== m.name) { const p = byName.get(f.type); if (p) visit(p, seen); }
    out.push(m);
  };
  for (const m of list) visit(m);
  return out;
}

export async function exportAll(prisma: Db, store: AttachmentFiles, settings: Record<string, unknown>): Promise<Uint8Array> {
  const zip: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const m of models()) {
    const rows = await delegate(prisma, m.name).findMany({ orderBy: { id: "asc" } });
    counts[m.name] = rows.length;
    if (m.name === "EmailAttachment") {
      // the bytes go in files/; the row keeps where to find them in the zip
      const out = [];
      for (const r of rows) {
        const bytes = await store.read(r as { data: Uint8Array | null; storageKey: string });
        const file = `files/${r["id"]}-${safeName(String(r["filename"]))}`;
        if (bytes) zip[file] = bytes;
        const { data: _d, storageKey: _k, ...rest } = r;
        out.push({ ...rest, file: bytes ? file : null });
      }
      zip[`data/${m.name}.json`] = strToU8(JSON.stringify(out, null, 2));
    } else zip[`data/${m.name}.json`] = strToU8(JSON.stringify(rows, null, 2));
  }
  const { sent: _sent, ...visibleSettings } = settings;
  zip["data/settings.json"] = strToU8(JSON.stringify(visibleSettings, null, 2));
  zip["manifest.json"] = strToU8(JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), tables: counts }, null, 2));
  return zipSync(zip, { level: 6 });
}

export class ImportError extends Error {}

/** Brings an export back into an EMPTY database. All or nothing (one transaction). Returns the rows per table. */
export async function importAll(prisma: Db, store: AttachmentFiles, zipBytes: Uint8Array): Promise<{ tables: Record<string, number>; settings: Record<string, unknown> | null }> {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(zipBytes); } catch { throw new ImportError("That isn't a zip file from Hyperfocus (Settings → Export my data)."); }
  const manifest = files["manifest.json"] ? JSON.parse(strFromU8(files["manifest.json"])) : null;
  if (manifest?.format !== FORMAT) throw new ImportError("That zip isn't a Hyperfocus export.");
  if (manifest.version > VERSION) throw new ImportError("This export comes from a newer Hyperfocus. Update the app first.");

  const list = inOrder(models());
  for (const m of list) if ((await delegate(prisma, m.name).count()) > 0) throw new ImportError(`Import only works into an empty database, and ${m.name} already has data. Nothing was changed.`);

  const tables: Record<string, number> = {};
  await prisma.$transaction(async (tx) => {
    for (const m of list) {
      const raw = files[`data/${m.name}.json`];
      if (!raw) continue;
      const dates = new Set(m.fields.filter((f) => f.type === "DateTime").map((f) => f.name));
      let rows = (JSON.parse(strFromU8(raw)) as Record<string, unknown>[]).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, dates.has(k) && v ? new Date(String(v)) : v])));
      if (m.name === "EmailAttachment") {
        rows = await Promise.all(rows.map(async ({ file, ...r }) => {
          const bytes = file ? files[String(file)] : undefined;
          if (!bytes) throw new ImportError(`The file for attachment ${r["id"]} is missing from the zip.`);
          return { ...r, ...(await store.save(bytes, String(r["mime"]))) };
        }));
      }
      if (rows.length) await delegate(tx as unknown as Db, m.name).createMany({ data: rows });
      tables[m.name] = rows.length;
      // the next id the app makes continues after the imported ones
      if (rows.length && m.fields.some((f) => f.name === "id" && f.default && typeof f.default === "object" && "name" in f.default && f.default.name === "autoincrement"))
        await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${m.name}"', 'id'), (SELECT max(id) FROM "${m.name}"))`);
    }
  }, { timeout: 600_000 });
  const settings = files["data/settings.json"] ? JSON.parse(strFromU8(files["data/settings.json"])) : null;
  return { tables, settings };
}

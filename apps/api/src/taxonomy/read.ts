import { createHash } from "node:crypto";
import fs from "node:fs";
import { Unzip, UnzipInflate, unzipSync, strFromU8 } from "fflate";

// Reading the open datasets (P6-04) without loading them whole: files are streamed and turned into rows as they come.
// Tab-separated (O*NET, GeoNames), CSV with quotes and line breaks inside fields (ESCO, CIP), files inside a zip, and
// the one Excel sheet the CIP–SOC crosswalk comes in.

export type Row = Record<string, string>;

/** Streams one file inside a zip (or a plain file when `entry` is null) as text chunks. */
export async function* textChunks(file: string, entry: string | null = null): AsyncGenerator<string> {
  if (!entry) {
    for await (const chunk of fs.createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 16 })) yield chunk as string;
    return;
  }
  const queue: string[] = [];
  let done = false;
  let failed: Error | null = null;
  let found = false;
  const waiter: { wake: (() => void) | null } = { wake: null };
  const decoder = new TextDecoder("utf-8");
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (f) => {
    if (f.name !== entry && !f.name.endsWith(`/${entry}`)) return;
    found = true;
    f.ondata = (err, chunk, final) => {
      if (err) failed = err;
      else queue.push(decoder.decode(chunk, { stream: !final }));
      if (final) done = true;
      waiter.wake?.();
    };
    f.start();
  };
  const input = fs.createReadStream(file, { highWaterMark: 1 << 16 });
  const pump = (async () => {
    for await (const chunk of input) unzip.push(chunk as Uint8Array);
    unzip.push(new Uint8Array(0), true);
    if (!found) { done = true; failed = new Error(`${entry} isn't in ${file}.`); }
    waiter.wake?.();
  })();
  while (true) {
    while (queue.length) yield queue.shift() as string;
    if (failed) throw failed;
    if (done) break;
    await new Promise<void>((r) => { waiter.wake = r; });
    waiter.wake = null;
  }
  await pump;
}

/** Lines of text (without their line ending). */
export async function* lines(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let rest = "";
  for await (const chunk of chunks) {
    const parts = (rest + chunk).split("\n");
    rest = parts.pop() ?? "";
    for (const p of parts) yield p.endsWith("\r") ? p.slice(0, -1) : p;
  }
  if (rest) yield rest.endsWith("\r") ? rest.slice(0, -1) : rest;
}

/** Tab-separated rows with a header line (O*NET). */
export async function* tsv(chunks: AsyncIterable<string>, { header = true, columns = [] as string[] } = {}): AsyncGenerator<Row> {
  let names = columns;
  for await (const line of lines(chunks)) {
    if (!line || line.startsWith("#")) continue;
    const cells = line.split("\t");
    if (header && !names.length) { names = cells; continue; }
    yield Object.fromEntries(names.map((n, i) => [n, cells[i] ?? ""]));
  }
}

/** CSV rows with a header line: quoted fields may hold commas, doubled quotes and line breaks. Excel's ="01" is unwrapped. */
export async function* csv(chunks: AsyncIterable<string>): AsyncGenerator<Row> {
  let names: string[] | null = null;
  let field = "";
  let record: string[] = [];
  let quoted = false;
  let afterQuote = false;
  const endField = () => { record.push(field); field = ""; afterQuote = false; };
  function* endRecord(): Generator<Row> {
    endField();
    const r = record;
    record = [];
    if (r.length === 1 && r[0] === "") return;
    if (!names) { names = r.map((n) => n.replace(/^﻿/, "")); return; }
    yield Object.fromEntries(names.map((n, i) => [n, r[i] ?? ""]));
  }
  for await (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i] as string;
      if (quoted) {
        if (ch === "\"") {
          if (chunk[i + 1] === "\"") { field += "\""; i++; } else { quoted = false; afterQuote = true; }
        } else field += ch;
      } else if (ch === "\"" && (field === "" || field === "=") && !afterQuote) {
        quoted = true;
        field = ""; // (Excel's ="01" means the text 01)
      } else if (ch === ",") endField();
      else if (ch === "\n") yield* endRecord();
      else if (ch !== "\r") field += ch;
    }
  }
  if (field || record.length) yield* endRecord();
}

/** Rows of one sheet of an .xlsx file (first row = names). Small files only (the crosswalk is ~0.4 MB). */
export function xlsxRows(file: string, sheetName?: string): Row[] {
  const zip = unzipSync(fs.readFileSync(file));
  const text = (name: string) => (zip[name] ? strFromU8(zip[name]) : "");
  const fromXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    fromXml([...(m[1] ?? "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  // which file holds the sheet: workbook.xml names → rels → path
  const sheets = [...text("xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => ({ name: fromXml(m[1] ?? ""), rid: m[2] }));
  const rels = Object.fromEntries([...text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const sheet = (sheetName ? sheets.find((s) => s.name === sheetName) : sheets[0]) ?? sheets[0];
  if (!sheet) throw new Error(`${file} has no sheets.`);
  const target = String(rels[sheet.rid ?? ""] ?? "worksheets/sheet1.xml").replace(/^\/?xl\//, "").replace(/^\//, "");
  const col = (ref: string) => { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
  const rows: string[][] = [];
  for (const r of text(`xl/${target}`).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of (r[1] ?? "").matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const type = /t="(\w+)"/.exec(attrs)?.[1];
      const body = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? "";
      cells[col(ref)] = type === "s" ? (shared[Number(v)] ?? "") : fromXml(v);
    }
    rows.push(Array.from(cells, (x) => x ?? ""));
  }
  const [head, ...data] = rows;
  if (!head) return [];
  return data.map((cells) => Object.fromEntries(head.map((n, i) => [n.trim(), (cells[i] ?? "").trim()])));
}

/** A short fingerprint of a file, for versions of datasets that don't number their releases. */
export function fingerprint(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
}

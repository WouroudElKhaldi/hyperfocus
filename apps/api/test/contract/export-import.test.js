import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { freePort } from "../support/stack.js";

// P4-08 acceptance: "Export reimports cleanly". A database of its own is filled (the demo plus an attachment) and
// exported; the export is imported into a second, empty database and exported again: both hold exactly the same rows
// and files. Both databases are this test's own (schemas in the test database), so no other test sees its data.

const SERVER_DIR = fileURLToPath(new URL("../../", import.meta.url));
const DB_DIR = fileURLToPath(new URL("../../../../packages/db/", import.meta.url));
const prismaCli = (args, url, input) =>
  execFileSync(process.execPath, [path.join(DB_DIR, "node_modules/prisma/build/index.js"), ...args], { cwd: DB_DIR, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", ...(input ? { input } : {}) });

const apis = [];
/** A fresh, migrated database and an API on it that does nothing on its own (no background jobs). */
async function apiOnNewDatabase(suffix) {
  const url = new URL(inject("databaseUrl"));
  const schema = `${url.searchParams.get("schema")}_${suffix}`;
  url.searchParams.set("schema", schema);
  prismaCli(["migrate", "deploy"], url.toString());
  const port = await freePort();
  const log = path.join(inject("tmpDir"), `api-${suffix}.log`);
  const out = fs.openSync(log, "a");
  const child = spawn(process.execPath, ["src/index.ts"], {
    cwd: SERVER_DIR, stdio: ["ignore", out, out],
    env: {
      ...process.env, DATABASE_URL: url.toString(), PORT: String(port), NOTIFY_DRY_RUN: "1", NO_BACKGROUND_JOBS: "1",
      SETTINGS_FILE: path.join(inject("tmpDir"), `settings-${suffix}.json`), BACKUP_DIR: path.join(inject("tmpDir"), `backups-${suffix}`),
      GMAIL_USER: " ", GMAIL_APP_KEY: " ", DEEPSEEK_API_KEY: "test-key", RATE_LIMIT_PER_MINUTE: "1000000", AI_RATE_LIMIT_PER_MINUTE: "1000000",
      DEEPSEEK_URL: `${inject("aiUrl")}/chat/completions`,
    },
  });
  const api = { url: `http://127.0.0.1:${port}`, child, dbUrl: url.toString(), schema };
  apis.push(api);
  for (const end = Date.now() + 60000; Date.now() < end; ) {
    try { if ((await fetch(`${api.url}/api/health`)).ok) return api; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`An API did not start:\n${fs.readFileSync(log, "utf8")}`);
}

let source, target;
beforeAll(async () => {
  [source, target] = await Promise.all([apiOnNewDatabase("export"), apiOnNewDatabase("import")]);
  // some data of every kind, and a file
  execFileSync(process.execPath, [fileURLToPath(new URL("../../../../scripts/demo-seed.mjs", import.meta.url)), new URL(source.url).port], { stdio: "pipe" });
  const email = await (await fetch(`${source.url}/api/emails`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json();
  await fetch(`${source.url}/api/emails/${email.id}/attachments?name=bytes.bin`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.from([0, 7, 255, 128]) });
}, 180000);

afterAll(async () => {
  for (const a of apis) {
    if (a.child.exitCode === null) { a.child.kill(); await new Promise((r) => a.child.once("exit", r)); }
    try { prismaCli(["db", "execute", "--url", a.dbUrl, "--stdin"], a.dbUrl, `DROP SCHEMA IF EXISTS "${a.schema}" CASCADE;`); } catch { /* gone */ }
  }
});

const exportFrom = async (base) => {
  const r = await fetch(`${base}/api/export`);
  expect(r.status).toBe(200);
  expect(r.headers.get("content-type")).toBe("application/zip");
  return new Uint8Array(await r.arrayBuffer());
};
// the export's contents, without the moment it was made
const contents = (zip) => {
  const files = unzipSync(zip);
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  delete manifest.exportedAt;
  return { manifest, data: Object.fromEntries(Object.entries(files).filter(([k]) => k !== "manifest.json").map(([k, v]) => [k, k.endsWith(".json") ? JSON.parse(strFromU8(v)) : [...v]])) };
};

describe("export my data (P4-08)", { timeout: 120000 }, () => {
  let first;
  it("exports every table as JSON and every file, with a manifest", async () => {
    first = await exportFrom(source.url);
    const c = contents(first);
    expect(c.manifest).toMatchObject({ format: "hyperfocus-export", version: 1 });
    expect(c.manifest.tables.Task).toBeGreaterThan(0);
    expect(c.manifest.tables.Pet).toBe(1);
    expect(c.manifest.tables.OutboxMessage).toBeUndefined(); // internal, not your data
    expect(Object.keys(c.data).some((k) => k.startsWith("files/") && k.endsWith("bytes.bin"))).toBe(true);
    expect(c.data["data/EmailAttachment.json"].every((a) => !("data" in a) && !("storageKey" in a))).toBe(true); // bytes live in files/
  });

  it("imports into an empty database, and exporting it again gives exactly the same data", async () => {
    const r = await fetch(`${target.url}/api/import`, { method: "POST", headers: { "Content-Type": "application/zip" }, body: first });
    expect(r.status, await r.clone().text()).toBe(200);
    const again = contents(await exportFrom(target.url));
    const original = contents(first);
    expect(again.manifest).toEqual(original.manifest);
    for (const [k, v] of Object.entries(original.data)) expect(again.data[k], k).toEqual(v);
    // and the copy keeps working: a new task gets the next id, after the imported ones
    const maxId = Math.max(...original.data["data/Task.json"].map((t) => t.id));
    const t = await (await fetch(`${target.url}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "after import" }) })).json();
    expect(t.id).toBe(maxId + 1);
  });

  it("refuses to import into a database that has data (nothing is changed), or a file that isn't an export", async () => {
    const twice = await fetch(`${target.url}/api/import`, { method: "POST", headers: { "Content-Type": "application/zip" }, body: first });
    expect(twice.status).toBe(400);
    expect((await twice.json()).error).toMatch(/only works into an empty database/);
    const junk = await fetch(`${target.url}/api/import`, { method: "POST", headers: { "Content-Type": "application/zip" }, body: Buffer.from("not a zip") });
    expect(junk.status).toBe(400);
  });
});

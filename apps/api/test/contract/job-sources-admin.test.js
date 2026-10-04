import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { ensureDefaultSources } from "../../src/radar/fetch.ts";
import { processBatch, receiveBatch } from "../../src/radar/ingest.ts";
import { get, ok, patch, post } from "../support/api.js";

// P6-18: job sources for admins (the owner is the admin in local mode): health, adding a board, off/on, check soon.

const stamp = Date.now();
const board = `acme${stamp}`;
let raw;

beforeAll(() => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
});
afterAll(async () => {
  await raw.jobSource.deleteMany({ where: { key: { in: [`greenhouse:${board}`, `lever:${board}`, `web:${board}.example`] } } });
  await raw.$disconnect();
});

describe("job sources (admin)", () => {
  let added;
  it("add a Greenhouse board: listed, waiting for its first check; the same board twice is refused", async () => {
    const r = await post("/api/admin/job-sources", { kind: "greenhouse", board: board.toUpperCase() });
    expect(r.status).toBe(201);
    added = r.body;
    expect(added).toMatchObject({ key: `greenhouse:${board}`, kind: "greenhouse", name: `${board.toUpperCase()} (Greenhouse)`, enabled: true, status: "waiting", postings: 0, lastBatch: null });
    expect((await raw.jobSource.findUnique({ where: { id: added.id } })).config).toEqual({ board });
    expect((await post("/api/admin/job-sources", { kind: "greenhouse", board })).status).toBe(409);
    expect((await post("/api/admin/job-sources", { kind: "greenhouse", board: "../etc" })).status).toBe(400);
    expect((await post("/api/admin/job-sources", { kind: "arbeitnow", board: "x" })).status).toBe(400);
  });

  it("health: after a delivery it is ok, with its postings and last batch; after an error it is failing", async () => {
    const source = await raw.jobSource.findUnique({ where: { id: added.id } });
    const b = await receiveBatch(raw, source, [{ id: 1, absolute_url: `https://boards.greenhouse.io/${board}/jobs/1`, title: "Junior Analyst", content: "<p>Excel.</p>", updated_at: new Date().toISOString(), location: { name: "Remote" } }], `adm-${stamp}`);
    await processBatch(raw, b.batchId);
    await raw.jobSource.update({ where: { id: added.id }, data: { lastRunAt: new Date(), lastOkAt: new Date(), lastItems: 1 } });
    let s = (await ok(get("/api/admin/job-sources"))).find((x) => x.id === added.id);
    expect(s).toMatchObject({ status: "ok", lastItems: 1, postings: 1, newThisWeek: 1, lastBatch: { status: "done", received: 1, created: 1 } });
    await raw.jobSource.update({ where: { id: added.id }, data: { lastError: "boards-api.greenhouse.io answered 404" } });
    s = (await ok(get("/api/admin/job-sources"))).find((x) => x.id === added.id);
    expect(s).toMatchObject({ status: "failing", lastError: "boards-api.greenhouse.io answered 404" });
  });

  it("switch off, rename, check soon", async () => {
    expect(await ok(patch(`/api/admin/job-sources/${added.id}`, { enabled: false, name: "Acme jobs" }))).toMatchObject({ enabled: false, status: "off", name: "Acme jobs" });
    const soon = await ok(patch(`/api/admin/job-sources/${added.id}`, { enabled: true, checkSoon: true }));
    expect(soon).toMatchObject({ enabled: true, status: "waiting", lastRunAt: null });
    expect((await patch("/api/admin/job-sources/999999", { enabled: false })).status).toBe(404);
  });

  it("a board without an API: added switched off, can't be switched on until its permission is recorded", async () => {
    const r = await post("/api/admin/job-sources", { kind: "webpage", name: "Example board", listUrl: `https://www.${board}.example/jobs`, linkPattern: "^/job/" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ key: `web:${board}.example`, kind: "webpage", enabled: false, status: "off", permission: "" });
    expect((await post("/api/admin/job-sources", { kind: "webpage", name: "x", listUrl: "http://plain.example/jobs", linkPattern: "x" })).status).toBe(400);
    expect((await post("/api/admin/job-sources", { kind: "webpage", name: "x", listUrl: "https://ok.example/jobs", linkPattern: "([" })).status).toBe(400);
    expect((await patch(`/api/admin/job-sources/${r.body.id}`, { enabled: true })).status).toBe(400);
    const allowed = await ok(patch(`/api/admin/job-sources/${r.body.id}`, { permission: "Allowed by email from the board, 2026-10-04", enabled: true }));
    expect(allowed).toMatchObject({ enabled: true, permission: "Allowed by email from the board, 2026-10-04" });
    // taking the permission back switches it off
    expect(await ok(patch(`/api/admin/job-sources/${r.body.id}`, { permission: "" }))).toMatchObject({ enabled: false, permission: "" });
    expect((await patch(`/api/admin/job-sources/${added.id}`, { permission: "x" })).status).toBe(400); // not a web board
  });

  it("the Lebanese boards are there, switched off, waiting for permission", async () => {
    await ensureDefaultSources(raw);
    const all = await ok(get("/api/admin/job-sources"));
    for (const key of ["web:jobsforlebanon", "web:jobslebanon"]) expect(all.find((x) => x.key === key)).toMatchObject({ kind: "webpage", enabled: false, permission: "" });
  });
});

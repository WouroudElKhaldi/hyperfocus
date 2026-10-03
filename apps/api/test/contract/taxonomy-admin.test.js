import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

// P6-09: the job list for admins (the owner is the admin in local mode), on the sample taxonomy.

const stamp = Date.now();
const local = `Mohandes Barmaja ${stamp}`;
let raw, dev, mine;
const search = async (q) => (await ok(get(`/api/taxonomy/search?kind=occupation&q=${encodeURIComponent(q)}`))).items;

beforeAll(() => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
});
afterAll(async () => {
  await raw.occupationTitle.deleteMany({ where: { kind: "local", title: { contains: String(stamp) } } });
  await raw.occupation.deleteMany({ where: { code: { startsWith: "local:" }, title: { contains: String(stamp) } } });
  await raw.$disconnect();
});

describe("taxonomy admin", () => {
  it("find an occupation by name, title or code; open it with its names", async () => {
    const { items } = await ok(get("/api/admin/taxonomy/occupations?q=software%20dev"));
    dev = items.find((o) => o.code === "onet:15-1252.00");
    expect(dev).toMatchObject({ title: "Software Developers", source: "onet", titles: expect.any(Number) });
    expect((await ok(get("/api/admin/taxonomy/occupations?q=onet:15-1252"))).items.map((o) => o.id)).toContain(dev.id);
    const d = await ok(get(`/api/admin/taxonomy/occupations/${dev.id}`));
    expect(d.titles.map((t) => t.title)).toContain("Software Engineer");
    expect((await get("/api/admin/taxonomy/occupations/999999")).status).toBe(404);
  });

  it("a local name is found by the typeahead; it can be removed, dataset names can't", async () => {
    const d = await ok(post(`/api/admin/taxonomy/occupations/${dev.id}/titles`, { title: local, lang: "ar" }));
    const t = d.titles.find((x) => x.title === local);
    expect(t).toMatchObject({ kind: "local", lang: "ar" });
    expect((await post(`/api/admin/taxonomy/occupations/${dev.id}/titles`, { title: local, lang: "ar" })).status).toBe(409);
    expect((await search("Mohandes Barmaja")).map((h) => h.code)).toContain("onet:15-1252.00");
    expect((await ok(get(`/api/admin/taxonomy/occupations?q=${encodeURIComponent(local)}`))).items.map((o) => o.id)).toEqual([dev.id]);
    const dataset = d.titles.find((x) => x.kind !== "local");
    expect((await del(`/api/admin/taxonomy/titles/${dataset.id}`)).status).toBe(400);
    expect((await del(`/api/admin/taxonomy/titles/${t.id}`)).status).toBe(204);
    expect((await ok(get(`/api/admin/taxonomy/occupations/${dev.id}`))).titles.map((x) => x.title)).not.toContain(local);
  });

  it("add a local occupation, edit it, merge it into a dataset one (shown as that one), unmerge", async () => {
    const r = await post("/api/admin/taxonomy/occupations", { title: `Delivery Rider ${stamp}`, description: "Rides." });
    expect(r.status).toBe(201);
    mine = r.body;
    expect(mine).toMatchObject({ code: `local:delivery-rider-${stamp}`, source: "local", titles: [{ title: `Delivery Rider ${stamp}`, kind: "preferred" }] });
    expect((await post("/api/admin/taxonomy/occupations", { title: `Delivery Rider ${stamp}` })).status).toBe(409);
    expect(await ok(patch(`/api/admin/taxonomy/occupations/${mine.id}`, { description: "Delivers by motorbike." }))).toMatchObject({ description: "Delivers by motorbike." });

    expect((await patch(`/api/admin/taxonomy/occupations/${mine.id}`, { sameAsId: mine.id })).status).toBe(400);
    const merged = await ok(patch(`/api/admin/taxonomy/occupations/${mine.id}`, { sameAsId: dev.id }));
    expect(merged.sameAs).toEqual({ id: dev.id, title: "Software Developers" });
    expect((await ok(get(`/api/admin/taxonomy/occupations/${dev.id}`))).mergedHere.map((o) => o.id)).toContain(mine.id);
    expect((await search(`Delivery Rider ${stamp}`)).map((h) => h.code)).toContain("onet:15-1252.00"); // shown as its twin
    expect((await patch(`/api/admin/taxonomy/occupations/${dev.id}`, { sameAsId: mine.id })).status).toBe(400); // no loops
    expect((await ok(patch(`/api/admin/taxonomy/occupations/${mine.id}`, { sameAsId: null }))).sameAs).toBeNull();
  });
});

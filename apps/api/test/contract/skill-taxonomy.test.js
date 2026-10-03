import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { get, ok, patch, post } from "../support/api.js";

// P6-08: a skill on your Skills map can be linked to a standard skill (optional). Free-text skills stay as they are;
// only real standard skills can be linked, and their name is copied in so the link survives anything.

let raw;
const code = `test-tech:Python-${Date.now()}`;
beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  await raw.taxonomySkill.create({ data: { code, type: "tool", name: "Python", hot: true, source: "test", version: "test" } });
});
afterAll(async () => {
  await raw.taxonomySkill.deleteMany({ where: { code } });
  await raw.$disconnect();
});

it("links, refuses what isn't in the standard list, unlinks, and leaves free-text skills alone", async () => {
  const plain = await ok(post("/api/skills", { name: "Explaining things simply" }));
  expect(plain).toMatchObject({ taxonomyCode: "", taxonomyLabel: "" });

  const s = await ok(post("/api/skills", { name: "python for data", taxonomyCode: code }));
  expect(s).toMatchObject({ name: "python for data", taxonomyCode: code, taxonomyLabel: "Python" }); // your name stays yours

  const bad = await post("/api/skills", { name: "x", taxonomyCode: "made-up:thing" });
  expect(bad.status).toBe(400);
  expect(bad.body.error).toContain("standard list");
  expect((await patch(`/api/skills/${plain.id}`, { taxonomyCode: "made-up:thing" })).status).toBe(400);

  expect(await ok(patch(`/api/skills/${s.id}`, { level: 2 }))).toMatchObject({ level: 2, taxonomyCode: code }); // other changes keep the link
  expect(await ok(patch(`/api/skills/${s.id}`, { taxonomyCode: "" }))).toMatchObject({ taxonomyCode: "", taxonomyLabel: "" });
  expect(await ok(patch(`/api/skills/${plain.id}`, { taxonomyCode: code }))).toMatchObject({ name: "Explaining things simply", taxonomyLabel: "Python" });
  const list = await ok(get("/api/skills"));
  expect(list.find((x) => x.id === s.id)).toMatchObject({ taxonomyCode: "" });
});

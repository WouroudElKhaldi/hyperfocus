import { PrismaClient } from "@hyperfocus/db";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { award, awardAtLeast } from "../../src/pet.ts";
import { asUser, tenancy } from "../../src/tenancy.ts";

// Pet points belong to the person earning them (found while building P5-07): the points code looked them up under the
// owner's id, so for anyone else an award that can grow (a study session continued) never grew, and every repeat tried to
// insert a duplicate. Here: someone who isn't the owner, through the same guarded client the app uses.

let raw, db;
const person = `pet-person-${Date.now()}`;
beforeAll(async () => {
  raw = new PrismaClient({ datasourceUrl: inject("databaseUrl") });
  db = raw.$extends(tenancy);
  await raw.user.create({ data: { id: person, name: "Pat", email: `${person}@example.com` } });
  await asUser(person, async () => await db.pet.create({ data: { name: "Bean", species: "cat", gender: "girl" } }));
});
afterAll(async () => {
  await raw.user.delete({ where: { id: person } }); // (everything they own goes with them)
  await raw.$disconnect();
});

it("a growing award grows for anyone, and a repeated award is ignored without an error", async () => {
  await asUser(person, async () => {
    expect(await awardAtLeast(db, "study:test", "study", 5)).not.toBeNull();
    const grown = await awardAtLeast(db, "study:test", "study", 12);
    expect(grown?.amount).toBeGreaterThanOrEqual(12);
    expect(await award(db, "win:test", "win", 3)).not.toBeNull();
    expect(await award(db, "win:test", "win", 3)).toBeNull();
  });
  const rows = await raw.petXp.findMany({ where: { userId: person, key: { in: ["study:test", "win:test"] } } });
  expect(rows).toHaveLength(2);
  expect(rows.find((r) => r.key === "study:test").amount).toBeGreaterThanOrEqual(12);
  // nothing landed on the owner
  expect(await raw.petXp.count({ where: { userId: "owner", key: { in: ["study:test", "win:test"] } } })).toBe(0);
});

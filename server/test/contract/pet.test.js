import { beforeAll, describe, expect, it } from "vitest";
import { get, ok, patch, post } from "../support/api.js";

// The database is shared by all test files, so the pet may already exist when this file runs.
async function ensurePet() {
  const s = await ok(get("/api/pet"));
  if (s.pet) return s;
  return ok(post("/api/pet", { name: "Mochi", species: "cat", color: "#7447E6", gender: "girl" }));
}

describe("companion pet", () => {
  it("serves the catalog without needing a pet", async () => {
    const c = await ok(get("/api/pet/catalog"));
    expect(Object.keys(c).sort()).toEqual(["ages", "auras", "backdrops", "items", "legendAt", "maxTraits", "patterns", "personalities", "points"]);
    expect(c.items.length).toBeGreaterThan(10);
  });

  it("validates a new pet", async () => {
    const current = await ok(get("/api/pet"));
    if (current.pet) return; // validation runs before creation only when there is no pet yet
    const e = async (b) => (await post("/api/pet", b)).body.error;
    expect(await e({ species: "cat", color: "#ffffff" })).toBe("Give your pet a name.");
    expect(await e({ name: "x", species: "dog", color: "#ffffff" })).toBe("Pick what kind of pet it is.");
    expect(await e({ name: "x", species: "cat", color: "pink" })).toBe("Pick a color.");
  });

  describe("with a pet", () => {
    let state;
    beforeAll(async () => { state = await ensurePet(); });

    it("returns the full state", async () => {
      expect(state.pet).toMatchObject({ name: expect.any(String), species: expect.any(String), traits: expect.any(Array) });
      for (const k of ["xp", "stage", "stageName", "mood", "stats", "badges", "items", "today", "points", "outfit"]) expect(state).toHaveProperty(k);
    });

    it("allows only one pet", async () => {
      expect((await post("/api/pet", { name: "Two", species: "fox", color: "#000000" })).status).toBe(409);
    });

    it("renames, sets traits (unknown ones dropped) and wears a free item", async () => {
      const s = await ok(patch("/api/pet", { name: "Mochi II", traits: ["not-a-trait"], gender: "girl", outfit: { head: "bow" } }));
      expect(s.pet.name).toBe("Mochi II");
      expect(s.pet.traits).toEqual([]);
      expect(s.outfit).toMatchObject({ head: "bow" });
    });

    it("refuses locked, unknown or wrong-slot clothing", async () => {
      expect((await patch("/api/pet", { outfit: { head: "tophat" } })).body.error).toMatch(/isn't unlocked yet/);
      expect((await patch("/api/pet", { outfit: { head: "nope" } })).body.error).toBe("Unknown clothing item.");
      expect((await patch("/api/pet", { outfit: { body: "bow" } })).body.error).toBe("Unknown clothing item.");
    });

    it("earns XP when a win is logged", async () => {
      const w = await ok(post("/api/wins", { text: "XP win" }));
      const s = await ok(get("/api/pet"));
      expect(s.recent).toEqual(expect.arrayContaining([expect.objectContaining({ source: "win", note: "XP win", amount: expect.any(Number) })]));
      expect(s.stats.wins).toBeGreaterThan(0);
      expect(w.id).toEqual(expect.any(Number));
    });

    it("earns XP once per finished task, never twice for the same task", async () => {
      const t = await ok(post("/api/tasks", { title: "XP task", priority: "high" }));
      await ok(patch(`/api/tasks/${t.id}`, { done: true }));
      await ok(patch(`/api/tasks/${t.id}`, { done: false }));
      await ok(patch(`/api/tasks/${t.id}`, { done: true }));
      const rows = (await ok(get("/api/pet"))).recent.filter((r) => r.note === "Finished: XP task");
      expect(rows).toHaveLength(1);
    });

    it("gives no XP for editing or un-ticking a task that was never finished", async () => {
      const t = await ok(post("/api/tasks", { title: "Never finished" }));
      await ok(patch(`/api/tasks/${t.id}`, { done: false, title: "Never finished" }));
      expect((await ok(get("/api/pet"))).recent.some((r) => r.note === "Finished: Never finished")).toBe(false);
    });
  });
});

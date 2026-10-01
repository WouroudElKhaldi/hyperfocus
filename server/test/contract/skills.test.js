import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

describe("skills", () => {
  it("creates a skill with clamped levels and default target 4", async () => {
    const s = await ok(post("/api/skills", { name: "  Testing  ", level: 9 }));
    expect(s).toMatchObject({ name: "Testing", level: 5, target: 4 });
    expect((await ok(post("/api/skills", { name: "Low", level: -3, target: 2 }))).level).toBe(0);
  });

  it("requires a name", async () => {
    expect((await post("/api/skills", { name: "" })).body.error).toBe("Give the skill a name.");
  });

  it("bulk-adds skills, skipping names already tracked (case-insensitive)", async () => {
    await ok(post("/api/skills", { name: "Bulk One" }));
    const all = await ok(post("/api/skills/bulk", { items: [{ name: "bulk one" }, { name: "Bulk Two", area: "Other", why: "because" }, { name: "" }] }));
    expect(all.filter((s) => s.name.toLowerCase() === "bulk one")).toHaveLength(1);
    expect(all.find((s) => s.name === "Bulk Two")).toMatchObject({ area: "Other", notes: "because" });
  });

  it("updates level and target (target never below 1)", async () => {
    const s = await ok(post("/api/skills", { name: "Lvl" }));
    expect(await ok(patch(`/api/skills/${s.id}`, { level: 3, target: 0 }))).toMatchObject({ level: 3, target: 1 });
  });

  it("suggests skills and makes a plan with the AI", async () => {
    expect((await post("/api/skills/suggest", { context: " " })).status).toBe(400);
    const sug = await ok(post("/api/skills/suggest", { context: "APIs feel shaky" }));
    expect(sug.skills[0]).toMatchObject({ name: expect.any(String), area: expect.any(String), why: expect.any(String) });
    const s = await ok(post("/api/skills", { name: "Plan me" }));
    const plan = await ok(post(`/api/skills/${s.id}/plan`));
    expect(plan).toMatchObject({ steps: expect.any(Array), books: expect.any(Array) });
    expect((await post("/api/skills/999999/plan")).status).toBe(404);
  });

  it("lists and deletes", async () => {
    const s = await ok(post("/api/skills", { name: "Delete me" }));
    expect((await ok(get("/api/skills"))).some((x) => x.id === s.id)).toBe(true);
    await ok(del(`/api/skills/${s.id}`));
    expect((await ok(get("/api/skills"))).some((x) => x.id === s.id)).toBe(false);
  });
});

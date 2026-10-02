import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

describe("goals", () => {
  it("creates a goal, with or without a target date", async () => {
    const g = await ok(post("/api/goals", { original: "Learn Rust", targetDate: "2026-12-31" }));
    expect(g).toMatchObject({ original: "Learn Rust", status: expect.any(String), actions: [], logs: [] });
    expect(g.targetDate.slice(0, 10)).toBe("2026-12-31");
    expect((await ok(post("/api/goals", { original: "No date" }))).targetDate).toBeNull();
  });

  it("validates the goal text and date", async () => {
    expect((await post("/api/goals", { original: "" })).body.error).toBe("Write your goal first.");
    expect((await post("/api/goals", { original: "x", targetDate: "nope" })).body.error).toBe("Invalid date.");
  });

  it("updates text, status and target date", async () => {
    const g = await ok(post("/api/goals", { original: "g" }));
    const u = await ok(patch(`/api/goals/${g.id}`, { refined: "better g", status: "achieved", targetDate: "2027-01-01" }));
    expect(u).toMatchObject({ refined: "better g", status: "achieved" });
    expect((await ok(patch(`/api/goals/${g.id}`, { targetDate: null }))).targetDate).toBeNull();
    expect((await patch(`/api/goals/${g.id}`, { targetDate: "bad" })).status).toBe(400);
  });

  it("adds actions, ticks and edits them, deletes them", async () => {
    const g = await ok(post("/api/goals", { original: "with actions" }));
    let r = await ok(post(`/api/goals/${g.id}/actions`, { texts: ["a", " ", "b"] }));
    expect(r.actions.map((a) => a.text)).toEqual(["a", "b"]);
    r = await ok(post(`/api/goals/${g.id}/actions`, { text: "c" }));
    expect(r.actions).toHaveLength(3);
    const a = await ok(patch(`/api/goal-actions/${r.actions[0].id}`, { done: true, text: "a!" }));
    expect(a).toMatchObject({ done: true, text: "a!" });
    await ok(del(`/api/goal-actions/${r.actions[1].id}`));
  });

  it("adds and deletes progress logs (newest first)", async () => {
    const g = await ok(post("/api/goals", { original: "logged" }));
    expect((await post(`/api/goals/${g.id}/logs`, { text: "" })).status).toBe(400);
    await ok(post(`/api/goals/${g.id}/logs`, { text: "first" }));
    const r = await ok(post(`/api/goals/${g.id}/logs`, { text: "second" }));
    expect(r.logs.map((l) => l.text)).toEqual(["second", "first"]);
    await ok(del(`/api/goal-logs/${r.logs[0].id}`));
  });

  it("analyses a goal with the AI and saves the verdict", async () => {
    const g = await ok(post("/api/goals", { original: "Finish course", targetDate: "2026-12-01" }));
    const r = await ok(post(`/api/goals/${g.id}/analyze`));
    expect(r.goal).toMatchObject({ refined: expect.any(String), verdict: "achievable", verdictNote: expect.any(String) });
    expect(r.goal.analyzedAt).not.toBeNull();
    expect(Array.isArray(r.actions)).toBe(true);
    expect((await post("/api/goals/999999/analyze")).status).toBe(404);
  });

  it("lists and deletes goals", async () => {
    const g = await ok(post("/api/goals", { original: "temporary" }));
    expect((await ok(get("/api/goals"))).some((x) => x.id === g.id)).toBe(true);
    await ok(del(`/api/goals/${g.id}`));
    expect((await ok(get("/api/goals"))).some((x) => x.id === g.id)).toBe(false);
  });

  // P2-08: a goal, step or progress entry that doesn't exist is "not found" (it used to be a 500, or a null body)
  it("answers 404 for a goal, step or progress entry that doesn't exist", async () => {
    const checks = [
      [await patch("/api/goals/999999", { refined: "x" }), "Goal not found."],
      [await del("/api/goals/999999"), "Goal not found."],
      [await post("/api/goals/999999/actions", { texts: ["a"] }), "Goal not found."],
      [await post("/api/goals/999999/logs", { text: "did it" }), "Goal not found."],
      [await post("/api/goals/999999/analyze"), "Goal not found."],
      [await patch("/api/goal-actions/999999", { done: true }), "Goal step not found."],
      [await del("/api/goal-actions/999999"), "Goal step not found."],
      [await del("/api/goal-logs/999999"), "Progress entry not found."],
    ];
    for (const [r, message] of checks) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe(message);
    }
  });
});

import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

describe("wins", () => {
  it("adds a manual win and shows it in the timeline", async () => {
    expect((await post("/api/wins", { text: " " })).status).toBe(400);
    const w = await ok(post("/api/wins", { text: "  Gave a talk  " }));
    expect(w.text).toBe("Gave a talk");
    const list = await ok(get("/api/wins"));
    expect(list.find((x) => x.id === `win-${w.id}`)).toMatchObject({ kind: "win", text: "Gave a talk", manual: true, winId: w.id });
  });

  it("merges finished tasks, posts and study (5+ min) into the timeline, newest first", async () => {
    const t = await ok(post("/api/tasks", { title: "Win task" }));
    await ok(patch(`/api/tasks/${t.id}`, { done: true }));
    const now = Date.now();
    const s = await ok(post("/api/study", { course: "Algo", startedAt: new Date(now - 40 * 60000).toISOString(), endedAt: new Date(now - 10 * 60000).toISOString() }));
    const list = await ok(get("/api/wins"));
    expect(list.find((x) => x.id === `task-${t.id}`)).toMatchObject({ kind: "task", text: "Finished: Win task" });
    expect(list.find((x) => x.id === `study-${s.id}`)).toMatchObject({ kind: "study", text: "Studied 30 min: Algo" });
    const dates = list.map((x) => x.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("summarises wins into talking points", async () => {
    for (const text of ["a", "b", "c"]) await ok(post("/api/wins", { text }));
    expect(await ok(post("/api/wins/summary"))).toEqual({ bullets: expect.any(Array), paragraph: expect.any(String) });
  });

  it("deletes a manual win", async () => {
    const w = await ok(post("/api/wins", { text: "oops" }));
    await ok(del(`/api/wins/${w.id}`));
    expect((await ok(get("/api/wins"))).some((x) => x.id === `win-${w.id}`)).toBe(false);
  });
});

describe("weekly reviews", () => {
  it("writes a review from the week's facts, lists and deletes it", async () => {
    const r = await ok(post("/api/reviews"));
    expect(r).toMatchObject({ id: expect.any(Number), label: expect.any(String), stats: expect.any(Object) });
    expect(r.content).toMatchObject({ headline: expect.any(String), wins: expect.any(Array), priorities: expect.any(Array), tinyStart: expect.any(String) });
    expect((await ok(get("/api/reviews")))[0].id).toBe(r.id);
    await ok(del(`/api/reviews/${r.id}`));
    expect((await ok(get("/api/reviews"))).some((x) => x.id === r.id)).toBe(false);
  });
});

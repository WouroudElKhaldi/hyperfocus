import { Step, Task } from "@hyperfocus/shared";
import { describe, expect, it } from "vitest";
import { day, del, get, ok, patch, post } from "../support/api.js";

describe("tasks", () => {
  it("creates a task with defaults and steps included", async () => {
    const t = await ok(post("/api/tasks", { title: "Write report" }));
    expect(t).toMatchObject({ title: "Write report", today: false, dueDay: null, priority: "normal", done: false, doneAt: null, steps: [] });
  });

  it("keeps a valid priority and falls back to normal for an unknown one", async () => {
    expect((await ok(post("/api/tasks", { title: "a", priority: "urgent", today: true, dueDay: day(1) }))).priority).toBe("urgent");
    expect((await ok(post("/api/tasks", { title: "b", priority: "whenever" }))).priority).toBe("normal");
  });

  it("rejects a blank title", async () => {
    const r = await post("/api/tasks", { title: " " });
    expect(r).toMatchObject({ status: 400, body: { error: "Task needs a title." } });
  });

  it("marks done (stamps doneAt) and undone (clears it)", async () => {
    const t = await ok(post("/api/tasks", { title: "finish me" }));
    const done = await ok(patch(`/api/tasks/${t.id}`, { done: true }));
    expect(done.done).toBe(true);
    expect(done.doneAt).not.toBeNull();
    const undone = await ok(patch(`/api/tasks/${t.id}`, { done: false }));
    expect(undone.doneAt).toBeNull();
  });

  it("updates priority (validated) and due day (clearable)", async () => {
    const t = await ok(post("/api/tasks", { title: "p", dueDay: day(2) }));
    expect((await ok(patch(`/api/tasks/${t.id}`, { priority: "high" }))).priority).toBe("high");
    expect((await patch(`/api/tasks/${t.id}`, { priority: "mega" })).status).toBe(400);
    expect((await ok(patch(`/api/tasks/${t.id}`, { dueDay: "" }))).dueDay).toBeNull();
  });

  it("lists open tasks before done ones", async () => {
    const list = await ok(get("/api/tasks"));
    const firstDone = list.findIndex((t) => t.done);
    if (firstDone >= 0) expect(list.slice(firstDone).every((t) => t.done)).toBe(true);
  });

  it("adds steps (single and many), ticks one, deletes one", async () => {
    const t = await ok(post("/api/tasks", { title: "with steps" }));
    let r = await ok(post(`/api/tasks/${t.id}/steps`, { steps: ["one", "", "two"] }));
    expect(r.steps.map((s) => s.text)).toEqual(["one", "two"]);
    r = await ok(post(`/api/tasks/${t.id}/steps`, { text: "three" }));
    expect(r.steps).toHaveLength(3);
    const s = await ok(patch(`/api/steps/${r.steps[0].id}`, { done: true }));
    expect(s.done).toBe(true);
    await ok(del(`/api/steps/${r.steps[1].id}`));
    expect((await ok(get("/api/tasks"))).find((x) => x.id === t.id).steps).toHaveLength(2);
  });

  it("every response matches the shared Task schema (@hyperfocus/shared)", async () => {
    const t = await ok(post("/api/tasks", { title: "schema task", dueDay: day(1), priority: "high" }));
    await ok(post(`/api/tasks/${t.id}/steps`, { steps: ["s"] }));
    await ok(patch(`/api/tasks/${t.id}`, { done: true }));
    expect(Task.safeParse(t).error?.issues ?? []).toEqual([]);
    const list = await ok(get("/api/tasks"));
    expect(Task.array().safeParse(list).error?.issues ?? []).toEqual([]);
    expect(Step.safeParse(list.find((x) => x.id === t.id).steps[0]).success).toBe(true);
  });

  it("deletes a task together with its steps", async () => {
    const t = await ok(post("/api/tasks", { title: "gone" }));
    await ok(post(`/api/tasks/${t.id}/steps`, { steps: ["s"] }));
    expect(await ok(del(`/api/tasks/${t.id}`))).toEqual({ ok: true });
    expect((await ok(get("/api/tasks"))).some((x) => x.id === t.id)).toBe(false);
  });

  // P2-07: a task or step that doesn't exist is "not found" (it used to be a 500, or a null body for adding steps)
  it("answers 404 for a task or step that doesn't exist", async () => {
    const checks = [
      [await patch("/api/tasks/999999", { title: "x" }), "Task not found."],
      [await del("/api/tasks/999999"), "Task not found."],
      [await post("/api/tasks/999999/steps", { steps: ["s"] }), "Task not found."],
      [await patch("/api/steps/999999", { done: true }), "Step not found."],
      [await del("/api/steps/999999"), "Step not found."],
    ];
    for (const [r, message] of checks) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe(message);
    }
  });
});

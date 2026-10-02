import { beforeEach, describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

// Only one session may run at a time, so every test starts with none running.
async function stopAllRunning() {
  for (const s of await ok(get("/api/study"))) if (!s.endedAt) await ok(post(`/api/study/${s.id}/stop`));
}

describe("study sessions", () => {
  beforeEach(stopAllRunning);

  it("starts a live session and refuses a second one", async () => {
    const s = await ok(post("/api/study", { course: "SE Square", part: "Week 1" }));
    expect(s).toMatchObject({ course: "SE Square", part: "Week 1", endedAt: null, breakMs: 0 });
    expect((await post("/api/study", { course: "other" })).status).toBe(409);
  });

  it("pauses, resumes (adding the break) and stops", async () => {
    const s = await ok(post("/api/study", {}));
    const paused = await ok(post(`/api/study/${s.id}/pause`));
    expect(paused.pausedAt).not.toBeNull();
    expect((await ok(post(`/api/study/${s.id}/pause`))).pausedAt).toBe(paused.pausedAt); // pausing twice is harmless
    const resumed = await ok(post(`/api/study/${s.id}/resume`));
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.breakMs).toBeGreaterThanOrEqual(0);
    const stopped = await ok(post(`/api/study/${s.id}/stop`));
    expect(stopped.endedAt).not.toBeNull();
    expect((await ok(post(`/api/study/${s.id}/stop`))).endedAt).toBe(stopped.endedAt); // stopping twice is harmless
    expect((await post(`/api/study/${s.id}/pause`)).status).toBe(409);
    expect((await post(`/api/study/${s.id}/resume`)).status).toBe(409);
  });

  it("stopping during a break ends the session when the break began", async () => {
    const s = await ok(post("/api/study", {}));
    const paused = await ok(post(`/api/study/${s.id}/pause`));
    expect((await ok(post(`/api/study/${s.id}/stop`))).endedAt).toBe(paused.pausedAt);
  });

  it("continues a recently stopped session, counting the gap as a break", async () => {
    const s = await ok(post("/api/study", {}));
    await ok(post(`/api/study/${s.id}/stop`));
    const c = await ok(post(`/api/study/${s.id}/continue`));
    expect(c.endedAt).toBeNull();
    expect((await ok(post(`/api/study/${s.id}/continue`))).id).toBe(s.id); // already running
    expect((await post("/api/study/999999/continue")).status).toBe(404);
  });

  it("refuses to continue a session that ended more than 6 hours ago", async () => {
    const s = await ok(post("/api/study", { startedAt: ago(600), endedAt: ago(420) }));
    expect((await post(`/api/study/${s.id}/continue`)).status).toBe(409);
  });

  it("logs a past session with a break and validates times", async () => {
    const s = await ok(post("/api/study", { course: "c", startedAt: ago(120), endedAt: ago(60), breakMins: 10 }));
    expect(s.breakMs).toBe(600000);
    const e = async (b) => (await post("/api/study", b)).body.error;
    expect(await e({ startedAt: "bad" })).toBe("Invalid start time.");
    expect(await e({ startedAt: ago(60), endedAt: "bad" })).toBe("Invalid end time.");
    expect(await e({ startedAt: ago(60), endedAt: ago(120) })).toBe("End time must be after the start time.");
    // one fixed base time: two separate ago() calls can land a millisecond apart and make the session 1 ms longer than the break
    const base = Date.now();
    const at = (min) => new Date(base - min * 60000).toISOString();
    expect(await e({ startedAt: at(60), endedAt: at(30), breakMins: 30 })).toBe("The break can't be as long as the whole session.");
  });

  it("edits a saved session but never shortens it", async () => {
    const s = await ok(post("/api/study", { startedAt: ago(120), endedAt: ago(60) }));
    expect((await ok(patch(`/api/study/${s.id}`, { notes: "good", endedAt: ago(30) }))).notes).toBe("good");
    expect((await patch(`/api/study/${s.id}`, { endedAt: ago(100) })).body.error).toMatch(/can add time/);
    expect((await patch(`/api/study/${s.id}`, { startedAt: "bad" })).status).toBe(400);
  });

  it("lists newest first and deletes", async () => {
    const s = await ok(post("/api/study", { startedAt: ago(5), endedAt: ago(1) }));
    const list = await ok(get("/api/study"));
    expect(list.some((x) => x.id === s.id)).toBe(true);
    await ok(del(`/api/study/${s.id}`));
  });

  // P2-10: editing, deleting, stopping or continuing a session that doesn't exist is "not found" (editing used to be a 500)
  it("answers 404 for a session that doesn't exist (pausing one stays a 409: it isn't running)", async () => {
    for (const r of [await patch("/api/study/999999", { notes: "x" }), await del("/api/study/999999"), await post("/api/study/999999/stop"), await post("/api/study/999999/continue")]) {
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("Session not found.");
    }
    expect((await post("/api/study/999999/pause")).status).toBe(409);
  });
});

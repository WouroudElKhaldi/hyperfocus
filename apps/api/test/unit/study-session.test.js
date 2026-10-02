import { describe, expect, it } from "vitest";
import { CONTINUE_WITHIN_MS, checkEdit, checkLogged, pause, reopen, resume, stateOf, stop } from "../../src/modules/study/session.ts";

// The study timer's state machine (P2-10), without a database.

const T0 = new Date("2026-10-02T09:00:00Z");
const at = (min) => new Date(T0.getTime() + min * 60000);
const running = { startedAt: T0, endedAt: null, pausedAt: null, breakMs: 0 };
const paused = { ...running, pausedAt: at(30) };
const stopped = { ...running, endedAt: at(60) };

describe("study session state machine", () => {
  it("knows the three states", () => {
    expect([stateOf(running), stateOf(paused), stateOf(stopped)]).toEqual(["running", "paused", "stopped"]);
  });

  it("pause: running → paused; pausing twice changes nothing; a stopped session can't pause", () => {
    expect(pause(running, at(30))).toEqual({ change: { pausedAt: at(30) } });
    expect(pause(paused, at(40))).toEqual({ nothing: true });
    expect(pause(stopped, at(70))).toEqual({ refuse: "This session isn't running." });
  });

  it("resume: the break is added to the break time", () => {
    expect(resume({ ...paused, breakMs: 60000 }, at(45))).toEqual({ change: { breakMs: 60000 + 15 * 60000, pausedAt: null } });
    expect(resume(running, at(45))).toEqual({ nothing: true });
    expect(resume(stopped, at(70))).toEqual({ refuse: "This session isn't running." });
  });

  it("stop: ends now, or when the break began; stopping twice changes nothing", () => {
    expect(stop(running, at(50))).toEqual({ change: { endedAt: at(50), pausedAt: null } });
    expect(stop(paused, at(50))).toEqual({ change: { endedAt: at(30), pausedAt: null } }); // time away is never counted
    expect(stop(stopped, at(90))).toEqual({ nothing: true });
  });

  it("continue: within 6 hours, the time away becomes a break", () => {
    expect(reopen(stopped, at(80), false)).toEqual({ change: { endedAt: null, pausedAt: null, breakMs: 20 * 60000 } });
    expect(reopen(running, at(80), false)).toEqual({ nothing: true });
    expect(reopen(stopped, at(80), true)).toEqual({ refuse: "Another session is running. Stop it first." });
    expect(reopen(stopped, new Date(at(60).getTime() + CONTINUE_WITHIN_MS + 1), false)).toEqual({ refuse: expect.stringContaining("more than 6 hours ago") });
    expect("change" in reopen(stopped, new Date(at(60).getTime() + CONTINUE_WITHIN_MS), false)).toBe(true); // exactly 6 hours is still fine
  });
});

describe("checking times", () => {
  it("a logged session ends after it starts, and its break is shorter than it", () => {
    expect(checkLogged(at(0), at(60), 30 * 60000)).toBeNull();
    expect(checkLogged(at(0), null, 0)).toBeNull();
    expect(checkLogged(at(60), at(60), 0)).toBe("End time must be after the start time.");
    expect(checkLogged(at(0), at(30), 30 * 60000)).toBe("The break can't be as long as the whole session.");
  });

  it("an edit can make a saved session longer, never shorter (a minute of slack)", () => {
    const saved = { startedAt: at(0), endedAt: at(60), pausedAt: null, breakMs: 10 * 60000 }; // 50 minutes of study
    expect(checkEdit(saved, { endedAt: at(90) })).toBeNull();
    expect(checkEdit(saved, { breakMs: 0 })).toBeNull();
    expect(checkEdit(saved, { breakMs: 11 * 60000 })).toBeNull(); // 1 minute shorter: within the slack
    expect(checkEdit(saved, { endedAt: at(30) })).toMatch(/can add time to a saved session but not remove it/);
    expect(checkEdit(saved, { startedAt: at(70) })).toBe("End time must be after the start time.");
    expect(checkEdit(running, { breakMs: 999 * 60000 })).toBeNull(); // a running session has no end to compare with yet
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backgroundJobs } from "../../src/jobs/index.ts";
import { inProcessScheduler } from "../../src/jobs/scheduler.ts";

// The scheduler interface and the in-process version (P2-21), with fake timers: no waiting.

const logs = () => {
  const errors = [];
  return { errors, log: { error: (o, msg) => errors.push({ ...o, msg }), warn: () => {} } };
};
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("in-process scheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a job first after firstAfterMs, then every everyMs", async () => {
    const s = inProcessScheduler({ log: logs().log });
    let runs = 0;
    s.add({ name: "j", everyMs: 1000, firstAfterMs: 300, run: async () => { runs++; } });
    s.start();
    await vi.advanceTimersByTimeAsync(299);
    expect(runs).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toBe(1);
    await vi.advanceTimersByTimeAsync(2700); // ticks at 1000, 2000, 3000
    expect(runs).toBe(4);
    await s.stop();
  });

  it("runs init once before the first run; a failing init is logged and the job still runs", async () => {
    const order = [];
    const { log, errors } = logs();
    const s = inProcessScheduler({ log });
    s.add({ name: "a", everyMs: 1000, firstAfterMs: 0, init: async () => { order.push("init"); }, run: async () => { order.push("run"); } });
    s.add({ name: "b", everyMs: 1000, firstAfterMs: 0, init: async () => { throw new Error("db down"); }, run: async () => { order.push("b"); } });
    s.start();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(order.filter((x) => x !== "b")).toEqual(["init", "run", "run"]);
    expect(order.filter((x) => x === "b")).toHaveLength(2);
    expect(errors).toEqual([expect.objectContaining({ job: "b", err: "db down", msg: "background job set-up failed" })]);
    await s.stop();
  });

  it("never runs a job twice at once: a tick during a slow run is skipped", async () => {
    const s = inProcessScheduler({ log: logs().log });
    let active = 0, maxActive = 0, runs = 0;
    s.add({ name: "slow", everyMs: 100, firstAfterMs: 0, run: async () => {
      active++; runs++; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 350));
      active--;
    } });
    s.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(maxActive).toBe(1);
    expect(runs).toBeLessThan(5); // 11 ticks, but each run takes 3.5 of them
    const stopped = s.stop(); // waits for the run in progress, so its timer has to move on
    await vi.advanceTimersByTimeAsync(400);
    await stopped;
  });

  it("a failing run is logged and doesn't stop the next run or other jobs", async () => {
    const { log, errors } = logs();
    const s = inProcessScheduler({ log });
    let fails = 0, other = 0;
    s.add({ name: "bad", everyMs: 100, firstAfterMs: 0, run: async () => { fails++; throw new Error("boom"); } });
    s.add({ name: "good", everyMs: 100, firstAfterMs: 0, run: async () => { other++; } });
    s.start();
    await vi.advanceTimersByTimeAsync(250);
    expect(fails).toBe(3);
    expect(other).toBe(3);
    expect(errors.filter((e) => e.job === "bad" && e.err === "boom")).toHaveLength(3);
    await s.stop();
  });

  it("stop() clears the timers and waits for runs in progress", async () => {
    const s = inProcessScheduler({ log: logs().log });
    let runs = 0, finished = false;
    s.add({ name: "j", everyMs: 100, firstAfterMs: 0, run: async () => { runs++; await new Promise((r) => setTimeout(r, 50)); finished = true; } });
    s.start();
    await flush();
    const stopped = s.stop();
    await vi.advanceTimersByTimeAsync(50);
    await stopped;
    expect(finished).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runs).toBe(1);
  });

  it("refuses two jobs with one name; runNow runs one on demand", async () => {
    const s = inProcessScheduler({ log: logs().log });
    let runs = 0;
    s.add({ name: "j", everyMs: 1000, firstAfterMs: 1000, run: async () => { runs++; } });
    expect(() => s.add({ name: "j", everyMs: 1, firstAfterMs: 1, run: async () => {} })).toThrow(/already exists/);
    await s.runNow("j");
    expect(runs).toBe(1);
    await expect(s.runNow("nope")).rejects.toThrow(/No background job/);
  });
});

describe("the background jobs", () => {
  it("keeps the timings the app always had", () => {
    const jobs = backgroundJobs({ prisma: {}, publisher: { configured: () => false, publish: async () => ({ ok: true }) }, events: {} });
    expect(jobs.map(({ name, everyMs, firstAfterMs }) => [name, everyMs, firstAfterMs])).toEqual([
      ["post-scheduler", 30000, 0],
      ["my-reminders", 20000, 5000],
      ["nudges", 60000, 15000],
      ["auto-backup", 6 * 3600000, 0],
    ]);
    expect(typeof jobs[0].init).toBe("function"); // posts left "posting" by a crash are failed first, never re-sent
  });
});

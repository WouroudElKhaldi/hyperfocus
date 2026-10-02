import type { Logger } from "pino";
import { errorInfo } from "../types.ts";

// The scheduler interface (P2-21): the background jobs (reminders, the post scheduler, backups) say what to run and how
// often; the scheduler decides how. Today that is in-process timers; in P4-05 a pg-boss queue in Postgres, which is
// safe with several API instances. The jobs don't change when it does.

export type Job = {
  name: string;
  /** How often it runs. */
  everyMs: number;
  /** When it runs the first time after start (0 = right away). */
  firstAfterMs: number;
  /** Runs once before the first run (like cleaning up after a crash). */
  init?: () => Promise<unknown>;
  run: () => Promise<unknown>;
};

export type Scheduler = {
  add(job: Job): void;
  start(): void;
  /** Stops the timers and waits for the runs in progress. */
  stop(): Promise<void>;
  /** Runs a job now (tests, or "catch up" buttons), with the same no-overlap rule. */
  runNow(name: string): Promise<void>;
};

type Timers = { setTimeout: typeof setTimeout; setInterval: typeof setInterval; clearTimeout: typeof clearTimeout; clearInterval: typeof clearInterval };

/**
 * Timers in this process. A job never overlaps itself (a slow run makes the next tick skip), and a failing run is
 * logged and never stops the other jobs or the next run.
 */
export function inProcessScheduler({ log, timers = globalThis }: { log: Pick<Logger, "error" | "warn">; timers?: Timers }): Scheduler {
  const jobs = new Map<string, Job>();
  const running = new Map<string, Promise<void>>();
  const handles: { timeouts: ReturnType<typeof setTimeout>[]; intervals: ReturnType<typeof setInterval>[] } = { timeouts: [], intervals: [] };
  const ready = new Map<string, Promise<void>>();

  const tick = (job: Job): Promise<void> => {
    const busy = running.get(job.name);
    if (busy) return busy; // still running: this tick is skipped
    const run = (async () => {
      try {
        await ready.get(job.name);
        await job.run();
      } catch (e) {
        log.error({ job: job.name, err: errorInfo(e).message }, "background job failed");
      } finally {
        running.delete(job.name);
      }
    })();
    running.set(job.name, run);
    return run;
  };

  return {
    add(job) {
      if (jobs.has(job.name)) throw new Error(`A background job named "${job.name}" already exists.`);
      jobs.set(job.name, job);
    },
    start() {
      for (const job of jobs.values()) {
        ready.set(job.name, (job.init?.() ?? Promise.resolve()).then(
          () => undefined,
          (e) => log.error({ job: job.name, err: errorInfo(e).message }, "background job set-up failed"),
        ));
        handles.timeouts.push(timers.setTimeout(() => void tick(job), job.firstAfterMs));
        handles.intervals.push(timers.setInterval(() => void tick(job), job.everyMs));
      }
    },
    async stop() {
      for (const t of handles.timeouts) timers.clearTimeout(t);
      for (const i of handles.intervals) timers.clearInterval(i);
      handles.timeouts = [];
      handles.intervals = [];
      await Promise.all(running.values());
    },
    async runNow(name) {
      const job = jobs.get(name);
      if (!job) throw new Error(`No background job named "${name}".`);
      await tick(job);
    },
  };
}

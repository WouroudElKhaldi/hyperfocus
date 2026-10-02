import { PgBoss } from "pg-boss";
import type { Logger } from "pino";
import { errorInfo } from "../types.ts";
import type { Job, Scheduler } from "./scheduler.ts";

// The background jobs on a pg-boss queue in PostgreSQL (P4-05, pg-boss is MIT). Safe with several API instances:
// every instance keeps its own timers, but a timer only *asks* for a run. The queue lets through one request per job per
// interval (`singletonSeconds`), and runs one at a time across all instances (`singleton` policy), on whichever instance
// picks it up first. The jobs themselves don't change (see scheduler.ts).

/** pg-boss keeps its tables in their own schema: "pgboss" next to the app's, or "<schema>_jobs" (each test run's own). */
function bossTarget(databaseUrl: string): { url: string; schema: string } {
  const u = new URL(databaseUrl);
  const appSchema = u.searchParams.get("schema");
  u.search = ""; // Prisma's ?schema=… means nothing to pg
  return { url: u.toString(), schema: appSchema && appSchema !== "public" ? `${appSchema}_jobs` : "pgboss" };
}

export function pgBossScheduler({ databaseUrl, log }: { databaseUrl: string; log: Pick<Logger, "error" | "warn" | "info"> }): Scheduler {
  const { url, schema } = bossTarget(databaseUrl);
  const boss = new PgBoss({ connectionString: url, schema });
  boss.on("error", (e: unknown) => log.error({ err: errorInfo(e).message }, "job queue error"));
  const jobs = new Map<string, Job>();
  const timers: ReturnType<typeof setTimeout>[] = [];
  let ready: Promise<void> = Promise.resolve();

  // a run, as the queue's worker does it: a failure is logged and never stops the next run (no retries: the next tick is the retry)
  const run = async (job: Job) => {
    try {
      await job.run();
    } catch (e) {
      log.error({ job: job.name, err: errorInfo(e).message }, "background job failed");
    }
  };
  const ask = (job: Job) =>
    boss.send(job.name, {}, { singletonSeconds: Math.max(1, Math.round(job.everyMs / 1000)), retryLimit: 0 }).catch((e: unknown) => {
      log.warn({ job: job.name, err: errorInfo(e).message }, "couldn't queue a background job");
    });

  return {
    add(job) {
      if (jobs.has(job.name)) throw new Error(`A background job named "${job.name}" already exists.`);
      jobs.set(job.name, job);
    },
    start() {
      ready = (async () => {
        await boss.start();
        for (const job of jobs.values()) {
          await boss.createQueue(job.name, { policy: "singleton" });
          await job.init?.().catch((e: unknown) => log.error({ job: job.name, err: errorInfo(e).message }, "background job set-up failed"));
          await boss.work(job.name, { pollingIntervalSeconds: 1 }, async () => run(job));
          timers.push(setTimeout(() => void ask(job), job.firstAfterMs));
          timers.push(setInterval(() => void ask(job), job.everyMs));
        }
        log.info({ jobs: [...jobs.keys()], schema }, "background jobs on the pg-boss queue");
      })().catch((e: unknown) => log.error({ err: errorInfo(e).message }, "the job queue couldn't start; background jobs are off"));
    },
    async stop() {
      for (const t of timers) clearTimeout(t); // (clearTimeout also clears intervals)
      timers.length = 0;
      await ready;
      await boss.stop({ graceful: true, timeout: 30_000 }); // lets a run in progress finish
    },
    async runNow(name) {
      const job = jobs.get(name);
      if (!job) throw new Error(`No background job named "${name}".`);
      await ready;
      await run(job);
    },
  };
}

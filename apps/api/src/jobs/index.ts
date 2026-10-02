import { backupIfDue } from "../backup.ts";
import type { EventBus } from "../events.ts";
import type { SocialPublisher } from "../modules/posts/publisher.ts";
import { failInterrupted, postScheduler } from "../modules/posts/scheduler.ts";
import { notify } from "../notify.ts";
import { deliverOutbox } from "../outbox.ts";
import { checkMyReminders, checkReminders } from "../reminders.ts";
import type { Db } from "../types.ts";
import type { Job } from "./scheduler.ts";

// The background jobs (P2-21), with the same timings as before. None of them run in the demo.

const SECOND = 1000;
const HOUR = 3600 * SECOND;

export function backgroundJobs({ prisma, publisher, events }: { prisma: Db; publisher: SocialPublisher; events: EventBus }): Job[] {
  return [
    {
      name: "post-scheduler", // sends scheduled LinkedIn posts
      everyMs: 30 * SECOND,
      firstAfterMs: 0, // right away: catch up on anything that came due while the app was closed
      init: () => failInterrupted(prisma), // a post left "posting" when the app stopped may be live: never re-sent
      run: postScheduler({ prisma, publisher, events }),
    },
    { name: "my-reminders", everyMs: 20 * SECOND, firstAfterMs: 5 * SECOND, run: () => checkMyReminders(prisma) },
    { name: "nudges", everyMs: 60 * SECOND, firstAfterMs: 15 * SECOND, run: () => checkReminders(prisma) }, // breaks, posts going live, events, the morning list
    { name: "outbox", everyMs: 5 * SECOND, firstAfterMs: 2 * SECOND, run: () => deliverOutbox(prisma, notify) }, // sends queued notifications (P4-06)
    { name: "auto-backup", everyMs: 6 * HOUR, firstAfterMs: 0, run: () => backupIfDue(prisma) }, // when the newest backup is over a day old
  ];
}

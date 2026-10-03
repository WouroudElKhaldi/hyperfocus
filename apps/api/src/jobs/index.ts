import { backupIfDue } from "../backup.ts";
import type { EventBus } from "../events.ts";
import type { SocialPublisher } from "../modules/posts/publisher.ts";
import { failInterrupted, postScheduler } from "../modules/posts/scheduler.ts";
import { notify } from "../notify.ts";
import { deliverOutbox } from "../outbox.ts";
import { checkMyReminders, checkReminders } from "../reminders.ts";
import { asSystem, forEachUser } from "../tenancy.ts";
import { withCredentials } from "../credentials.ts";
import type { KeyRing } from "../secrets.ts";
import type { Db } from "../types.ts";
import type { Job } from "./scheduler.ts";

// The background jobs (P2-21), with the same timings as before. Jobs that touch people's data run once per person, as that
// person (P5-03: the tenancy guard scopes every query); the outbox and the backup touch nobody's rows. None of them run in the demo.

const SECOND = 1000;
const HOUR = 3600 * SECOND;

export function backgroundJobs({ prisma, publisher, events, secrets }: { prisma: Db; publisher: SocialPublisher; events: EventBus; secrets?: KeyRing | null }): Job[] {
  // once per person, as that person, with their own credentials (their n8n webhook for their scheduled posts)
  const each = (fn: () => Promise<unknown>) => forEachUser(prisma, () => withCredentials(prisma, secrets, fn));
  return [
    {
      name: "post-scheduler", // sends scheduled LinkedIn posts
      everyMs: 30 * SECOND,
      firstAfterMs: 0, // right away: catch up on anything that came due while the app was closed
      init: () => asSystem(() => failInterrupted(prisma)), // a post left "posting" when the app stopped may be live: never re-sent (everyone's)
      run: () => each(postScheduler({ prisma, publisher, events })),
    },
    { name: "my-reminders", everyMs: 20 * SECOND, firstAfterMs: 5 * SECOND, run: () => each(() => checkMyReminders(prisma)) },
    { name: "nudges", everyMs: 60 * SECOND, firstAfterMs: 15 * SECOND, run: () => each(() => checkReminders(prisma)) }, // breaks, posts going live, events, the morning list
    { name: "outbox", everyMs: 5 * SECOND, firstAfterMs: 2 * SECOND, run: () => asSystem(() => deliverOutbox(prisma, notify)) }, // sends queued notifications (P4-06)
    { name: "auto-backup", everyMs: 6 * HOUR, firstAfterMs: 0, run: () => backupIfDue(prisma) }, // when the newest backup is over a day old
  ];
}

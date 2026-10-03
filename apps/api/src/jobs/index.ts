import { backupIfDue } from "../backup.ts";
import type { EventBus } from "../events.ts";
import type { SocialPublisher } from "../modules/posts/publisher.ts";
import { failInterrupted, postScheduler } from "../modules/posts/scheduler.ts";
import { notify } from "../notify.ts";
import { deliverOutbox } from "../outbox.ts";
import { checkMyReminders, checkReminders } from "../reminders.ts";
import { asSystem, currentUserId, forEachUser } from "../tenancy.ts";
import { type AppAi, withCredentials } from "../credentials.ts";
import { type Channel, deliverTo } from "../notifications.ts";
import { DIGEST, digestSender, queueDigest } from "../digest.ts";
import { applyChatRetention } from "../retention.ts";
import { processQueued } from "../radar/ingest.ts";
import { ensureDefaultSources, fetchDue } from "../radar/fetch.ts";
import { applyPostingRetention } from "../radar/retention.ts";
import { matchNewPostings } from "../radar/matcher.ts";
import type { KeyRing } from "../secrets.ts";
import type { Db } from "../types.ts";
import type { Job } from "./scheduler.ts";

// The background jobs (P2-21), with the same timings as before. Jobs that touch people's data run once per person, as that
// person (P5-03: the tenancy guard scopes every query); the outbox and the backup touch nobody's rows. None of them run in the demo.

const SECOND = 1000;
const HOUR = 3600 * SECOND;

export function backgroundJobs({ prisma, publisher, events, secrets, mode = "local", push = null, appMail = null, owners = [], radarFetch = false }: { prisma: Db; publisher: SocialPublisher; events: EventBus; secrets?: KeyRing | null; mode?: "local" | "cloud"; push?: Channel | null; appMail?: ((to: string, subject: string, text: string) => Promise<void>) | null; owners?: string[]; radarFetch?: boolean }): Job[] {
  // once per person, as that person, with their own credentials (their n8n webhook for their scheduled posts)
  // notifications: the bell always, and a desktop pop-up in local mode (P5-11)
  const send = deliverTo(prisma, { desktop: mode === "local" ? (note) => notify(note.title, note.body) : null, push });
  // (the owner's own .env services, like their AI key or their n8n, only in the owner's turn: local mode, or an
  // ADMIN_EMAILS address in cloud mode)
  const ownerOrNone = async (): Promise<AppAi> => {
    if (mode === "local") return "owner";
    const me = await prisma.user.findUnique({ where: { id: currentUserId() ?? "" }, select: { email: true } });
    return me && owners.includes(me.email.toLowerCase()) ? "owner" : "none";
  };
  const each = (fn: () => Promise<unknown>) => forEachUser(prisma, async () => withCredentials(prisma, secrets, fn, await ownerOrNone()));
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
    { name: "outbox", everyMs: 5 * SECOND, firstAfterMs: 2 * SECOND, run: () => asSystem(() => deliverOutbox(prisma, send)) }, // sends queued notifications (P4-06)
    // the daily email digest (P5-11): queued per person when it is their time, then sent from the app's Gmail
    { name: "email-digest", everyMs: 60 * SECOND, firstAfterMs: 10 * SECOND, run: () => each(() => queueDigest(prisma)) },
    ...(appMail ? [{ name: "email-digest-send", everyMs: 15 * SECOND, firstAfterMs: 12 * SECOND, run: () => asSystem(() => deliverOutbox(prisma, digestSender(prisma, appMail), { kind: DIGEST })) }] : []),
    // how long AI chats are kept, as each person chose (P5-12)
    { name: "chat-retention", everyMs: 6 * HOUR, firstAfterMs: 30 * SECOND, run: () => each(() => applyChatRetention(prisma)) },
    // Job Radar (P6): queued batches, fetching from the free sources, and dropping stale postings
    { name: "radar-ingest", everyMs: 10 * SECOND, firstAfterMs: 8 * SECOND, run: () => processQueued(prisma) },
    ...(radarFetch ? [{ name: "radar-fetch", everyMs: 10 * 60 * SECOND, firstAfterMs: 45 * SECOND, init: () => ensureDefaultSources(prisma), run: () => fetchDue(prisma) }] : []),
    { name: "radar-match", everyMs: 30 * SECOND, firstAfterMs: 20 * SECOND, run: () => matchNewPostings(prisma) }, // P6-23
    { name: "radar-retention", everyMs: 6 * HOUR, firstAfterMs: 60 * SECOND, run: () => applyPostingRetention(prisma) },
    { name: "auto-backup", everyMs: 6 * HOUR, firstAfterMs: 0, run: () => backupIfDue(prisma) }, // when the newest backup is over a day old
  ];
}

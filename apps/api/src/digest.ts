import { clockIn, reached } from "./clock.ts";
import { getSettings } from "./notify.ts";
import { enqueue, type Send } from "./outbox.ts";
import { asUser } from "./tenancy.ts";
import type { Db } from "./types.ts";

// The daily email digest (P5-11): once a day, at the time each person chose (on their own clock), an email with the
// day's notifications they haven't read yet. Sent from the website's own Gmail (the one in .env that also sends the
// account emails) to the person's email address. Nothing unread = no email that day.

export const DIGEST = "email-digest";

/** Runs as one person (inside forEachUser): queues today's digest when it is time and there is something to tell. */
export async function queueDigest(prisma: Db, now = new Date()): Promise<void> {
  const s = await getSettings(prisma);
  if (!s.emailDigest || !reached(s.digestAt, s.timeZone, now)) return;
  const day = clockIn(s.timeZone, now).day;
  const since = new Date(now.getTime() - 24 * 3600_000);
  const unread = await prisma.notification.findMany({ where: { readAt: null, createdAt: { gte: since } }, orderBy: { id: "asc" }, take: 30 });
  if (!unread.length) return;
  const lines = unread.map((n) => `• ${n.title}${n.body ? `\n  ${n.body}` : ""}`).join("\n");
  const count = `${unread.length} thing${unread.length > 1 ? "s" : ""}`;
  // (the key makes it once a day: the same day again is ignored)
  await enqueue(prisma, `digest:${day}`, `Your Hyperfocus day: ${count}`, `Here's what came up today that you haven't seen yet:\n\n${lines}\n\nOpen Hyperfocus to see them all. You can switch this email off in Settings → Where notifications go.`, DIGEST);
}

/** Sends a queued digest to the person it is for, by email. */
export function digestSender(prisma: Db, send: (to: string, subject: string, text: string) => Promise<void>): Send {
  return (note) =>
    asUser(note.userId, async () => {
      const [user, profile] = await Promise.all([
        prisma.user.findUnique({ where: { id: note.userId }, select: { email: true } }),
        prisma.profile.findFirst({ select: { email: true } }),
      ]);
      const to = user?.email || profile?.email || "";
      if (!to) return { ok: true }; // (no address anywhere: nothing to send to; Settings says so)
      await send(to, note.title, note.body);
      return { ok: true };
    });
}

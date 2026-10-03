import { clockIn, reached } from "../clock.ts";
import { getSettings } from "../notify.ts";
import { enqueue } from "../outbox.ts";
import type { Db } from "../types.ts";
import { specOf } from "./match.ts";

// Telling people about new matches (P6-24), per filter as they chose: once a day (the top 5, at their morning time,
// on their own clock), once a week (Monday morning), as they come (each one, but never more than 5 a day), or not at
// all. It goes through the notifications (P5-11): the bell, push on their devices, quiet hours, and their daily email.
// Runs as one person (inside forEachUser). Each match is told about once.

const TOP = 5;
const REALTIME_PER_DAY = 5;

const line = (m: { posting: { title: string; company: string } }) => `${m.posting.title}${m.posting.company ? ` · ${m.posting.company}` : ""}`;

export async function queueRadarDigest(db: Db, now = new Date()): Promise<number> {
  const settings = await getSettings(db);
  const { day } = clockIn(settings.timeZone, now);
  const morning = reached(settings.morningAt, settings.timeZone, now);
  // Monday on their own clock
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  let sent = 0;
  for (const f of await db.jobFilter.findMany({ where: { enabled: true }, select: { id: true, name: true, spec: true } })) {
    const digest = specOf(f.spec).digest;
    if (digest === "off") continue;
    const fresh = await db.jobMatch.findMany({
      where: { filterId: f.id, status: "new", notifiedAt: null, posting: { archivedAt: null } },
      include: { posting: { select: { title: true, company: true } } },
      orderBy: [{ score: "desc" }, { id: "asc" }],
      take: digest === "realtime" ? REALTIME_PER_DAY : TOP,
    });
    if (!fresh.length) continue;

    if (digest === "realtime") {
      const already = await db.outboxMessage.count({ where: { key: { startsWith: `radar-now:${day}:` } } });
      for (const m of fresh.slice(0, Math.max(0, REALTIME_PER_DAY - already))) {
        await enqueue(db, `radar-now:${day}:${m.id}`, `📡 A new job for you: ${m.posting.title}`, `${line(m)}. Why: ${(Array.isArray(m.reasons) ? (m.reasons as string[]) : []).slice(0, 2).join(" · ")}`);
        await db.jobMatch.updateMany({ where: { id: m.id }, data: { notifiedAt: now } });
        sent++;
      }
      continue;
    }
    if (!morning || (digest === "weekly" && weekday !== 1)) continue;
    const key = `radar-${digest}:${f.id}:${day}`;
    if (await db.outboxMessage.count({ where: { key } })) continue; // already told today: the rest wait for the next one
    const count = fresh.length;
    await enqueue(db, key, `📡 ${count} new job${count > 1 ? "s" : ""} for you (${f.name})`, fresh.map(line).join("\n"));
    await db.jobMatch.updateMany({ where: { id: { in: fresh.map((m) => m.id) } }, data: { notifiedAt: now } });
    sent++;
  }
  return sent;
}

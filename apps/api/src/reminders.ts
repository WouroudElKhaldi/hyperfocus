import { getSettings, remind } from "./notify.ts";
import { enqueue } from "./outbox.ts";
import type { Db } from "./types.ts";
import { eventOccurrences, addDays } from "./modules/calendar/calendar.ts";

// Checks once a minute for things worth a gentle nudge. Every reminder is sent once (see remind()).
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d: Date) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export async function checkReminders(prisma: Db): Promise<void> {
  const settings = await getSettings(prisma);
  if (!settings.reminders) return;
  const now = new Date();

  // 1. Studying for a long stretch: suggest a break (hyperfocus is easy to miss)
  const running = await prisma.studySession.findFirst({ where: { endedAt: null } });
  if (running && !running.pausedAt) {
    const activeMin = (now.getTime() - running.startedAt.getTime() - running.breakMs) / 60000;
    const k = Math.floor(activeMin / settings.breakEveryMin);
    if (k >= 1) await remind(prisma, `break:${running.id}:${k}`, "☕ Time for a little break?", `You've been studying ${Math.round(activeMin)} minutes. Stretch, drink water, rest your eyes. Press "Take a break" so it isn't counted.`);
  }

  // 2. A scheduled post goes live soon
  const soon = await prisma.post.findMany({ where: { status: "scheduled", scheduledAt: { gt: now, lte: new Date(now.getTime() + 10 * 60000) } } });
  for (const p of soon) {
    if (!p.scheduledAt) continue; // never null here (the query asks for a time), but the type can't know that
    await remind(prisma, `post10:${p.id}:${p.scheduledAt.getTime()}`, `⏰ Your post goes live at ${clock(p.scheduledAt)}`, `"${((p.draft || p.thought).split("\n")[0] ?? "").slice(0, 80)}" Last chance to edit it.`);
  }

  // 3. Calendar events with a reminder, sent the chosen number of minutes before they start
  const occ = await eventOccurrences(prisma, localDay(now), addDays(localDay(now), 1));
  for (const o of occ) {
    if (o.allDay || !o.startTime || o.remindMin < 0) continue;
    const start = new Date(`${o.day}T${o.startTime}:00`);
    const remindAt = start.getTime() - o.remindMin * 60000;
    if (now.getTime() >= remindAt && now.getTime() < start.getTime() + 5 * 60000) {
      const when = o.remindMin === 0 ? "now" : o.remindMin >= 60 ? `in ${Math.round(o.remindMin / 60)} h` : `in ${o.remindMin} min`;
      await remind(prisma, `ev:${o.id}:${o.day}:${o.remindMin}`, `📅 ${o.title}`, `${o.startTime}${o.location ? " · " + o.location : ""} (${when})`);
    }
  }

  // 4. Morning: what is on for today (once a day, after the chosen time)
  const [hh = Number.NaN, mm = Number.NaN] = settings.morningAt.split(":").map(Number);
  if (now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm)) {
    const today = localDay(now);
    const tasks = await prisma.task.findMany({ where: { done: false, OR: [{ today: true }, { dueDay: today }] } });
    if (tasks.length) {
      await remind(prisma, `morning:${today}`, `🌸 Today: ${tasks.length} thing${tasks.length > 1 ? "s" : ""}`, `Start with: ${tasks[0]?.title}. Just that one.`);
    }
  }
}

// ---------- reminders she wrote herself ----------
export { REMINDER_REPEATS } from "@hyperfocus/shared/constants"; // one list for the API and the website

// the next time a repeating reminder should fire, strictly after `from`
export function nextOccurrence(at: Date, repeat: string, from = new Date()): Date {
  let d = new Date(at);
  for (let i = 0; i < 4000; i++) {
    d = new Date(d);
    if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else { do d.setDate(d.getDate() + 1); while (repeat === "weekdays" && (d.getDay() === 0 || d.getDay() === 6)); }
    if (d > from) return d;
  }
  return d;
}

// Fires every reminder that is due. A one-off is finished afterwards; a repeating one moves to its next time.
// If the app was off when it was due, it still fires once when the app starts (and says when it was set for).
// (P4-06) Each reminder is claimed and its notification queued in one transaction: both happen or neither, and a reminder
// another copy of the API already took is skipped. The outbox job sends the notification a few seconds later.
export async function checkMyReminders(prisma: Db, now = new Date()): Promise<void> {
  const due = await prisma.reminder.findMany({ where: { done: false, at: { lte: now } }, orderBy: { at: "asc" } });
  for (const r of due) {
    const late = now.getTime() - r.at.getTime() > 5 * 60000;
    const body = r.note || (late ? `This was set for ${new Date(r.at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Your reminder");
    await prisma.$transaction(async (tx) => {
      const claim = await tx.reminder.updateMany({
        where: { id: r.id, done: false, at: r.at },
        data: r.repeat === "none" ? { done: true, lastFiredAt: now } : { at: nextOccurrence(r.at, r.repeat, now), lastFiredAt: now },
      });
      if (claim.count === 1) await enqueue(tx, `reminder:${r.id}:${r.at.getTime()}`, `⏰ ${r.title}`, body);
    });
  }
}

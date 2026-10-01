import { getSettings, remind, notify } from "./notify.js";
import { eventOccurrences, addDays } from "./calendar.js";

// Checks once a minute for things worth a gentle nudge. Every reminder is sent once (see remind()).
const pad = (n) => String(n).padStart(2, "0");
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export async function checkReminders(prisma) {
  const settings = getSettings();
  if (!settings.reminders) return;
  const now = new Date();

  // 1. Studying for a long stretch: suggest a break (hyperfocus is easy to miss)
  const running = await prisma.studySession.findFirst({ where: { endedAt: null } });
  if (running && !running.pausedAt) {
    const activeMin = (now - running.startedAt - running.breakMs) / 60000;
    const k = Math.floor(activeMin / settings.breakEveryMin);
    if (k >= 1) await remind(`break:${running.id}:${k}`, "☕ Time for a little break?", `You've been studying ${Math.round(activeMin)} minutes. Stretch, drink water, rest your eyes. Press "Take a break" so it isn't counted.`);
  }

  // 2. A scheduled post goes live soon
  const soon = await prisma.post.findMany({ where: { status: "scheduled", scheduledAt: { gt: now, lte: new Date(now.getTime() + 10 * 60000) } } });
  for (const p of soon) {
    await remind(`post10:${p.id}:${p.scheduledAt.getTime()}`, `⏰ Your post goes live at ${clock(p.scheduledAt)}`, `"${(p.draft || p.thought).split("\n")[0].slice(0, 80)}" Last chance to edit it.`);
  }

  // 3. Calendar events with a reminder, sent the chosen number of minutes before they start
  const occ = await eventOccurrences(prisma, localDay(now), addDays(localDay(now), 1));
  for (const o of occ) {
    if (o.allDay || !o.startTime || o.remindMin < 0) continue;
    const start = new Date(`${o.day}T${o.startTime}:00`);
    const remindAt = start.getTime() - o.remindMin * 60000;
    if (now.getTime() >= remindAt && now.getTime() < start.getTime() + 5 * 60000) {
      const when = o.remindMin === 0 ? "now" : o.remindMin >= 60 ? `in ${Math.round(o.remindMin / 60)} h` : `in ${o.remindMin} min`;
      await remind(`ev:${o.id}:${o.day}:${o.remindMin}`, `📅 ${o.title}`, `${o.startTime}${o.location ? " · " + o.location : ""} (${when})`);
    }
  }

  // 4. Morning: what is on for today (once a day, after the chosen time)
  const [hh, mm] = settings.morningAt.split(":").map(Number);
  if (now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm)) {
    const today = localDay(now);
    const tasks = await prisma.task.findMany({ where: { done: false, OR: [{ today: true }, { dueDay: today }] } });
    if (tasks.length) {
      await remind(`morning:${today}`, `🌸 Today: ${tasks.length} thing${tasks.length > 1 ? "s" : ""}`, `Start with: ${tasks[0].title}. Just that one.`);
    }
  }
}

// ---------- reminders she wrote herself ----------
export const REMINDER_REPEATS = ["none", "daily", "weekdays", "weekly"];

// the next time a repeating reminder should fire, strictly after `from`
export function nextOccurrence(at, repeat, from = new Date()) {
  let d = new Date(at);
  for (let i = 0; i < 4000; i++) {
    d = new Date(d);
    if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else { do d.setDate(d.getDate() + 1); while (repeat === "weekdays" && (d.getDay() === 0 || d.getDay() === 6)); }
    if (d > from) return d;
  }
  return d;
}

let busy = false;
// Fires every reminder that is due. A one-off is finished afterwards; a repeating one moves to its next time.
// If the app was off when it was due, it still fires once when the app starts (and says when it was set for).
export async function checkMyReminders(prisma, now = new Date()) {
  if (busy) return;
  busy = true;
  try {
    const due = await prisma.reminder.findMany({ where: { done: false, at: { lte: now } }, orderBy: { at: "asc" } });
    for (const r of due) {
      const late = now - r.at > 5 * 60000;
      const body = r.note || (late ? `This was set for ${new Date(r.at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "Your reminder");
      const out = await notify(`⏰ ${r.title}`, body);
      if (!out.ok) console.error("Reminder notification failed:", out.error);
      await prisma.reminder.update({ where: { id: r.id }, data: r.repeat === "none" ? { done: true, lastFiredAt: now } : { at: nextOccurrence(r.at, r.repeat, now), lastFiredAt: now } });
    }
  } finally { busy = false; }
}

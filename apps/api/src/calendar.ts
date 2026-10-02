import type { Event } from "@hyperfocus/db";
import { type AiJson, chat } from "./ai.ts";
import { activeMs, type Db } from "./types.ts";

// Everything about the calendar lives here so the website, the reminders and the export all agree
// on what happens when. Days are local "YYYY-MM-DD" strings, times are "HH:mm".
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s: string) => new Date(`${s}T00:00:00`);
export const addDays = (s: string, n: number): string => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
const toMin = (t: string) => { const [h = Number.NaN, m = Number.NaN] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const CATEGORIES = ["event", "study", "work", "personal", "health"];
export const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly"];

// The days (inside from..to) on which a stored event happens.
export function occurrenceDays(ev: Pick<Event, "day" | "repeat" | "repeatUntil" | "exceptions">, from: string, to: string): string[] {
  const skip = new Set((ev.exceptions || "").split(",").filter(Boolean));
  const out: string[] = [];
  if (ev.repeat === "none") {
    if (ev.day >= from && ev.day <= to && !skip.has(ev.day)) out.push(ev.day);
    return out;
  }
  const until = ev.repeatUntil || "9999-12-31";
  const base = parseDay(ev.day);
  const end = to < until ? to : until;
  for (let d = ev.day > from ? ev.day : from; d <= end; d = addDays(d, 1)) {
    const dt = parseDay(d), dow = dt.getDay();
    const hit =
      ev.repeat === "daily" ||
      (ev.repeat === "weekdays" && dow >= 1 && dow <= 5) ||
      (ev.repeat === "weekly" && dow === base.getDay()) ||
      (ev.repeat === "monthly" && dt.getDate() === base.getDate());
    if (hit && !skip.has(d)) out.push(d);
  }
  return out;
}

/** One day on which an event happens (a repeating event has many). */
export type Occurrence = Pick<Event, "id" | "title" | "day" | "startTime" | "endTime" | "allDay" | "category" | "location" | "notes" | "repeat" | "repeatUntil" | "remindMin"> & { occId: string; baseDay: string };

export async function eventOccurrences(prisma: Db, from: string, to: string): Promise<Occurrence[]> {
  const events = await prisma.event.findMany();
  const out: Occurrence[] = [];
  for (const ev of events) {
    for (const day of occurrenceDays(ev, from, to)) {
      out.push({
        id: ev.id, occId: `${ev.id}_${day}`, title: ev.title, day, baseDay: ev.day,
        startTime: ev.startTime, endTime: ev.endTime, allDay: ev.allDay || !ev.startTime,
        category: ev.category, location: ev.location, notes: ev.notes,
        repeat: ev.repeat, repeatUntil: ev.repeatUntil, remindMin: ev.remindMin,
      });
    }
  }
  return out.sort((a, b) => (a.day + (a.startTime || "")).localeCompare(b.day + (b.startTime || "")));
}

// Everything the calendar shows for from..to (inclusive), in one call.
export async function buildCalendar(prisma: Db, from: string, to: string) {
  const start = parseDay(from), end = parseDay(addDays(to, 1));
  const [events, tasks, goals, study, posts] = await Promise.all([
    eventOccurrences(prisma, from, to),
    prisma.task.findMany({ where: { dueDay: { gte: from, lte: to } } }),
    prisma.goal.findMany({ where: { targetDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) } } }),
    prisma.studySession.findMany({ where: { startedAt: { gte: start, lt: end } }, orderBy: { startedAt: "asc" } }),
    prisma.post.findMany({ where: { OR: [{ scheduledAt: { gte: start, lt: end } }, { postedAt: { gte: start, lt: end } }] } }),
  ]);
  return {
    from, to, events,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, day: t.dueDay, done: t.done })),
    goals: goals.map((g) => ({ id: g.id, title: g.refined || g.original, day: g.targetDate?.toISOString().slice(0, 10), status: g.status })),
    study: study.map((s) => ({ id: s.id, course: s.course, part: s.part, startedAt: s.startedAt, endedAt: s.endedAt, pausedAt: s.pausedAt, breakMs: s.breakMs })),
    posts: posts.map((p) => ({ id: p.id, title: ((p.draft || p.thought).split("\n")[0] ?? "").slice(0, 80), status: p.status, at: p.status === "scheduled" ? p.scheduledAt : p.postedAt })),
  };
}

// ---------- free time + AI planning ----------
type Window = { day: string; from: string; to: string };
function freeWindows(occurrences: Occurrence[], days: string[], now: Date, open = "09:00", close = "21:00", minLen = 45): Window[] {
  const out: Window[] = [];
  for (const day of days) {
    let from = toMin(open);
    if (day === ymd(now)) from = Math.max(from, Math.ceil((now.getHours() * 60 + now.getMinutes() + 15) / 30) * 30);
    const busy = occurrences
      .filter((o) => o.day === day && !o.allDay && o.startTime)
      .map((o): [number, number] => [toMin(o.startTime), o.endTime ? toMin(o.endTime) : toMin(o.startTime) + 60])
      .sort((a, b) => a[0] - b[0]);
    let cursor = from;
    for (const [s, e] of busy) {
      if (s - cursor >= minLen) out.push({ day, from: toTime(cursor), to: toTime(s) });
      cursor = Math.max(cursor, e);
    }
    if (toMin(close) - cursor >= minLen) out.push({ day, from: toTime(cursor), to: close });
  }
  return out;
}

export async function planStudyBlocks(prisma: Db) {
  const now = new Date();
  const today = ymd(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const occ = await eventOccurrences(prisma, today, addDays(today, 6)); // = days[0]..days[6]
  const windows = freeWindows(occ, days, now);
  if (!windows.length) return { blocks: [], note: "There's no free time left in the next 7 days between 09:00 and 21:00." };

  const [goals, skills, tasks, sessions] = await Promise.all([
    prisma.goal.findMany({ where: { status: "active" } }),
    prisma.skill.findMany(),
    prisma.task.findMany({ where: { done: false }, take: 12 }),
    prisma.studySession.findMany({ where: { startedAt: { gte: new Date(Date.now() - 7 * 86400000) }, endedAt: { not: null } } }),
  ]);
  const studied = Math.round(sessions.reduce((t, s) => t + activeMs(s), 0) / 60000);
  const gaps = skills.filter((s) => s.level > 0 && s.target > s.level).sort((a, b) => b.target - b.level - (a.target - a.level)).slice(0, 4);

  const out = await chat(
    [
      {
        role: "system",
        content: `You help a software engineer with ADHD/autism traits and anxiety plan realistic study blocks for the next 7 days, on her way from mid to senior level (she follows a course program called SE Square).
Choose 3 to 5 blocks ONLY inside the free windows given. Rules: each block 25 to 90 minutes; at most 2 blocks per day; leave at least 2 days with nothing or only one short block so she can rest; prefer a gentle start (short first block, not a huge one); never put a block outside its window. "title" starts with a verb and says what to do, using her goals, skill gaps, tasks or course work given (never invent courses). "why" is one short kind sentence.
Reply ONLY with JSON: {"blocks": [{"day": "YYYY-MM-DD", "start": "HH:mm", "minutes": number, "title": string, "why": string}]}.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          today, freeWindows: windows, studyMinutesLast7Days: studied,
          goals: goals.map((g) => g.refined || g.original), biggestSkillGaps: gaps.map((s) => s.name),
          openTasks: tasks.map((t) => t.title),
        }),
      },
    ],
    { json: true, temperature: 0.4 },
  );

  // never trust the AI with the clock: keep only blocks that really fit inside a free window
  const blocks: { day: string; startTime: string; endTime: string; minutes: number; title: string; why: string }[] = [];
  for (const b of (Array.isArray(out.blocks) ? out.blocks : []) as AiJson[]) {
    const minutes = Math.round(Number(b.minutes));
    if (!DAY_RE.test(b.day || "") || !TIME_RE.test(b.start || "") || !(minutes >= 15 && minutes <= 120)) continue;
    const s = toMin(b.start), e = s + minutes;
    const fits = windows.some((w) => w.day === b.day && s >= toMin(w.from) && e <= toMin(w.to));
    const clashes = blocks.some((x) => x.day === b.day && s < toMin(x.endTime) && e > toMin(x.startTime));
    if (fits && !clashes) blocks.push({ day: b.day, startTime: b.start, endTime: toTime(e), minutes, title: String(b.title || "Study").slice(0, 80), why: String(b.why || "") });
  }
  return { blocks: blocks.sort((a, b) => (a.day + a.startTime).localeCompare(b.day + b.startTime)).slice(0, 5), note: "" };
}

// ---------- AI quick add ----------
export async function parseEventText(text: string) {
  const now = new Date();
  const out = await chat(
    [
      {
        role: "system",
        content: `You turn a short sentence into a calendar event. Today is ${ymd(now)} (${now.toLocaleDateString("en-US", { weekday: "long" })}). Resolve words like "tomorrow", "Friday" or "next week" from today.
Rules: if no time is given, set "allDay" to true and leave startTime/endTime empty. If a start time is given without a length, make it 1 hour. Times are 24-hour "HH:mm". "category" is one of: ${CATEGORIES.join(", ")} (study for learning/courses, work for job things, health for doctor/sport, personal for the rest, else event). "repeat" is one of: ${REPEATS.join(", ")} ("every Monday" = weekly, "every day" = daily, "weekdays" = weekdays). Keep the title short and in her words. Never invent details she didn't say.
Reply ONLY with JSON: {"title": string, "day": "YYYY-MM-DD", "allDay": boolean, "startTime": string, "endTime": string, "category": string, "repeat": string, "location": string}.`,
      },
      { role: "user", content: text },
    ],
    { json: true, temperature: 0.1 },
  );
  const allDay = !!out.allDay || !TIME_RE.test(out.startTime || "");
  return {
    title: String(out.title || text).slice(0, 120),
    day: DAY_RE.test(out.day || "") ? out.day : ymd(now),
    allDay,
    startTime: allDay ? "" : out.startTime,
    endTime: allDay || !TIME_RE.test(out.endTime || "") ? "" : out.endTime,
    category: CATEGORIES.includes(out.category) ? out.category : "event",
    repeat: REPEATS.includes(out.repeat) ? out.repeat : "none",
    location: String(out.location || "").slice(0, 120),
  };
}

// ---------- .ics export (Google Calendar, Apple Calendar, Outlook, phones) ----------
const icsEsc = (s: unknown) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDay = (d: string) => d.replace(/-/g, "");
const icsDate = (day: string, time: string) => `${icsDay(day)}T${time.replace(":", "")}00`;
const fold = (line: string) => { // lines must not be longer than 75 bytes
  const out: string[] = [];
  let s = line;
  while (Buffer.byteLength(s) > 74) {
    let cut = 74;
    while (Buffer.byteLength(s.slice(0, cut)) > 74) cut--;
    out.push(s.slice(0, cut));
    s = " " + s.slice(cut);
  }
  out.push(s);
  return out.join("\r\n");
};

export async function buildIcs(prisma: Db): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hyperfocus//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Hyperfocus"];
  const add = (...lines: string[]) => lines.forEach((l) => L.push(l));

  for (const ev of await prisma.event.findMany()) {
    add("BEGIN:VEVENT", `UID:event-${ev.id}@thought-studio`, `DTSTAMP:${stamp}`, `SUMMARY:${icsEsc(ev.title)}`);
    if (ev.allDay || !ev.startTime) add(`DTSTART;VALUE=DATE:${icsDay(ev.day)}`, `DTEND;VALUE=DATE:${icsDay(addDays(ev.day, 1))}`);
    else add(`DTSTART:${icsDate(ev.day, ev.startTime)}`, `DTEND:${icsDate(ev.day, ev.endTime || toTime(Math.min(1439, toMin(ev.startTime) + 60)))}`);
    if (ev.location) add(`LOCATION:${icsEsc(ev.location)}`);
    if (ev.notes) add(`DESCRIPTION:${icsEsc(ev.notes)}`);
    add(`CATEGORIES:${icsEsc(ev.category)}`);
    const rule = ({ daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY" } as Record<string, string | undefined>)[ev.repeat];
    if (rule) add(`RRULE:${rule}${ev.repeatUntil ? `;UNTIL=${icsDay(ev.repeatUntil)}T235959` : ""}`);
    for (const d of (ev.exceptions || "").split(",").filter(Boolean)) {
      add(ev.allDay || !ev.startTime ? `EXDATE;VALUE=DATE:${icsDay(d)}` : `EXDATE:${icsDate(d, ev.startTime)}`);
    }
    if (ev.remindMin >= 0 && ev.startTime) add("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(ev.title)}`, `TRIGGER:-PT${ev.remindMin}M`, "END:VALARM");
    add("END:VEVENT");
  }

  const allDay = (uid: string, day: string, summary: string) => add("BEGIN:VEVENT", `UID:${uid}@thought-studio`, `DTSTAMP:${stamp}`, `SUMMARY:${icsEsc(summary)}`, `DTSTART;VALUE=DATE:${icsDay(day)}`, `DTEND;VALUE=DATE:${icsDay(addDays(day, 1))}`, "END:VEVENT");
  for (const t of await prisma.task.findMany({ where: { done: false, dueDay: { not: null } } })) if (t.dueDay) allDay(`task-${t.id}`, t.dueDay, `✅ ${t.title}`); // never null: the query asks for a day
  for (const g of await prisma.goal.findMany({ where: { status: "active", targetDate: { not: null } } })) if (g.targetDate) allDay(`goal-${g.id}`, g.targetDate.toISOString().slice(0, 10), `🎯 Goal deadline: ${(g.refined || g.original).slice(0, 80)}`);
  for (const p of await prisma.post.findMany({ where: { status: "scheduled", scheduledAt: { not: null } } })) {
    const d = p.scheduledAt;
    if (!d) continue; // never null: the query asks for a time
    add("BEGIN:VEVENT", `UID:post-${p.id}@thought-studio`, `DTSTAMP:${stamp}`, `SUMMARY:${icsEsc("💼 LinkedIn post goes live")}`, `DTSTART:${icsDate(ymd(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`)}`, `DTEND:${icsDate(ymd(d), `${pad(d.getHours())}:${pad(Math.min(59, d.getMinutes() + 15))}`)}`, `DESCRIPTION:${icsEsc((p.draft || p.thought).slice(0, 200))}`, "END:VEVENT");
  }
  add("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

export { DAY_RE, TIME_RE, toMin, toTime };

// Date helpers and constants shared by the calendar views. Days are local "YYYY-MM-DD" strings, times are "HH:mm".
import i18next from "i18next";
import type { Strings } from "../../../i18n/en.ts";
import type { CalendarData, Occurrence } from "../../../types.ts";

/** Everything that happens on one day, after the layer toggles. */
export type DayInfo = {
  events: Occurrence[]; tasks: CalendarData["tasks"]; goals: CalendarData["goals"]; study: CalendarData["study"]; posts: CalendarData["posts"]; studyMins: number;
};
/** The event form. `id` is set when editing; `occDay` is the day that was clicked in a repeating series. */
export type EventForm = {
  id?: number; occDay?: string; title: string; day: string; allDay: boolean; startTime: string; endTime: string;
  category: string; repeat: string; repeatUntil: string; location: string; notes: string; remindMin: number;
};
/** What is carried while dragging something on the calendar. */
export type MoveEvent = { id: number; startTime?: string; endTime?: string };
export type DragPayload = ({ type: "event" } & MoveEvent) | { type: "task"; id: number };
export type Upcoming = { key: string; day: string; time: string; title: string; cls: string };

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s: string) => new Date(`${s}T00:00:00`);
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayStr = () => ymd(new Date());
export const toMin = (t: string) => { const [h = Number.NaN, m = Number.NaN] = t.split(":").map(Number); return h * 60 + m; };
export const toTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const minutesOfDate = (d: Date) => d.getHours() * 60 + d.getMinutes();

export const startOfWeek = (s: string) => { const d = parseDay(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }; // Monday
export const weekDays = (s: string) => { const a = startOfWeek(s); return Array.from({ length: 7 }, (_, i) => addDays(a, i)); };
export const monthGrid = (s: string) => {
  const first = parseDay(s.slice(0, 8) + "01");
  const start = startOfWeek(ymd(first));
  const lastDay = ymd(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const weeks = Math.ceil((((parseDay(lastDay).getTime() - parseDay(start).getTime()) / 86400000) + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
};

export const fmtDay = (s: string, o: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => parseDay(s).toLocaleDateString(i18next.language, o);
export const fmtHour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(i18next.language, { hour: "numeric" });
export const fmtClock = (d: string | null) => new Date(d ?? 0).toLocaleTimeString(i18next.language, { hour: "2-digit", minute: "2-digit" });
export const fmtMins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${pad(m % 60)}m` : ""}` : `${m}m`);

// (labels in the language files, P3-28; read each time so they follow the chosen language)
type CalLabel = keyof Strings["cal"];
const labelled = <I,>(id: I, key: CalLabel) => ({ id, get label(): string { return i18next.t(`cal.${key}`); } });
export const CATEGORIES = [labelled("event", "cGeneral"), labelled("study", "cStudy"), labelled("work", "cWork"), labelled("personal", "cPersonal"), labelled("health", "cHealth")];
export const REPEATS = [labelled("none", "rNone"), labelled("daily", "rDaily"), labelled("weekdays", "rWeekdays"), labelled("weekly", "rWeekly"), labelled("monthly", "rMonthly")];
export const REMINDERS = [labelled(-1, "mNone"), labelled(0, "mStart"), labelled(5, "m5"), labelled(10, "m10"), labelled(15, "m15"), labelled(30, "m30"), labelled(60, "m60"), labelled(1440, "m1440")];
/** Mon…Sun in the chosen language (Jan 1, 2024 was a Monday). */
export const weekNames = () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(i18next.language, { weekday: "short" }));

// Side-by-side lanes for items that overlap in time, so nothing is drawn on top of anything else.
// items: [{ start, end, ... }] in minutes. Returns the same items with lane and lanes (number of lanes in their group).
export function layoutLanes<T extends { start: number; end: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const groups: { end: number; items: T[] }[] = [];
  let cur: { end: number; items: T[] } | null = null;
  for (const it of sorted) {
    if (!cur || it.start >= cur.end) { cur = { end: it.end, items: [] }; groups.push(cur); }
    cur.items.push(it);
    cur.end = Math.max(cur.end, it.end);
  }
  const out: (T & { lane: number; lanes: number })[] = [];
  for (const g of groups) {
    const laneEnds: number[] = [];
    for (const it of g.items) {
      let lane = laneEnds.findIndex((e) => e <= it.start);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(it.end); } else laneEnds[lane] = it.end;
      out.push({ ...it, lane, lanes: 0 }); // lanes is filled in below, once the group is complete
    }
    for (const it of out.slice(out.length - g.items.length)) it.lanes = laneEnds.length;
  }
  return out;
}

export const blankEvent = (day: string, startTime = "", endTime = ""): EventForm => ({
  title: "", day, allDay: !startTime, startTime, endTime, category: "event", repeat: "none", repeatUntil: "",
  location: "", notes: "", remindMin: -1,
});

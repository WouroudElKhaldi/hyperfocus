// Date helpers and constants shared by the calendar views. Days are local "YYYY-MM-DD" strings, times are "HH:mm".
const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s) => new Date(`${s}T00:00:00`);
export const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayStr = () => ymd(new Date());
export const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const toTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const minutesOfDate = (d) => d.getHours() * 60 + d.getMinutes();

export const startOfWeek = (s) => { const d = parseDay(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }; // Monday
export const weekDays = (s) => { const a = startOfWeek(s); return Array.from({ length: 7 }, (_, i) => addDays(a, i)); };
export const monthGrid = (s) => {
  const first = parseDay(s.slice(0, 8) + "01");
  const start = startOfWeek(ymd(first));
  const lastDay = ymd(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const weeks = Math.ceil((((parseDay(lastDay) - parseDay(start)) / 86400000) + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
};

export const fmtDay = (s, o = { weekday: "long", day: "numeric", month: "long" }) => parseDay(s).toLocaleDateString([], o);
export const fmtHour = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
export const fmtClock = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${pad(m % 60)}m` : ""}` : `${m}m`);

export const CATEGORIES = [
  { id: "event", label: "General" },
  { id: "study", label: "Study" },
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
  { id: "health", label: "Health" },
];
export const REPEATS = [
  { id: "none", label: "Does not repeat" },
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Every weekday" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
];
export const REMINDERS = [
  { id: -1, label: "No reminder" },
  { id: 0, label: "At the start" },
  { id: 5, label: "5 minutes before" },
  { id: 10, label: "10 minutes before" },
  { id: 15, label: "15 minutes before" },
  { id: 30, label: "30 minutes before" },
  { id: 60, label: "1 hour before" },
  { id: 1440, label: "1 day before" },
];

// Side-by-side lanes for items that overlap in time, so nothing is drawn on top of anything else.
// items: [{ start, end, ... }] in minutes. Returns the same items with lane and lanes (number of lanes in their group).
export function layoutLanes(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const groups = [];
  let cur = null;
  for (const it of sorted) {
    if (!cur || it.start >= cur.end) { cur = { end: it.end, items: [] }; groups.push(cur); }
    cur.items.push(it);
    cur.end = Math.max(cur.end, it.end);
  }
  const out = [];
  for (const g of groups) {
    const laneEnds = [];
    for (const it of g.items) {
      let lane = laneEnds.findIndex((e) => e <= it.start);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(it.end); } else laneEnds[lane] = it.end;
      out.push({ ...it, lane });
    }
    for (const it of out.slice(out.length - g.items.length)) it.lanes = laneEnds.length;
  }
  return out;
}

export const blankEvent = (day, startTime = "", endTime = "") => ({
  title: "", day, allDay: !startTime, startTime, endTime, category: "event", repeat: "none", repeatUntil: "",
  location: "", notes: "", remindMin: -1,
});

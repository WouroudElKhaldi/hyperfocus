// Each person's clock (P5-11): their time zone (Settings; empty = this server's). Quiet hours, the morning note and the
// email digest are about *their* evening and *their* morning, wherever the server runs.

const pad = (n: number) => String(n).padStart(2, "0");

/** Is this a time zone the computer knows (like "Asia/Beirut")? */
export function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The day ("2026-10-03") and time ("21:30") right now for someone in `tz` ("" = the server's own). */
export function clockIn(tz: string, at = new Date()): { day: string; time: string; minutes: number } {
  if (!tz || !validTimeZone(tz)) {
    const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
    return { day: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, time, minutes: at.getHours() * 60 + at.getMinutes() };
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const hh = Number(parts["hour"]) % 24;
  const mm = Number(parts["minute"]);
  return { day: `${parts["year"]}-${parts["month"]}-${parts["day"]}`, time: `${pad(hh)}:${pad(mm)}`, minutes: hh * 60 + mm };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Quiet hours from–to ("22:00"–"07:00" goes over midnight); both empty, or equal = none. */
export function inQuietHours(from: string, to: string, tz: string, at = new Date()): boolean {
  if (!from || !to || from === to) return false;
  const now = clockIn(tz, at).minutes;
  const a = toMinutes(from);
  const b = toMinutes(to);
  return a < b ? now >= a && now < b : now >= a || now < b;
}

/** Has `hhmm` been reached today on their clock? */
export const reached = (hhmm: string, tz: string, at = new Date()) => clockIn(tz, at).minutes >= toMinutes(hhmm);

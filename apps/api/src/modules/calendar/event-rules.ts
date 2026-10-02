import type { Event } from "@hyperfocus/db";
import type { Cleaned } from "../../pet.ts";
import type { UncheckedJson } from "../../types.ts";
import { CATEGORIES, DAY_RE, REPEATS, TIME_RE, toMin } from "./calendar.ts";

// The checks for a calendar event (P2-12: moved out of the Express file unchanged, now unit-tested). They compare fields
// with each other (no start time means all day; the end must be after the start), so they stay one function rather than a
// schema per field. The first problem found is the one reported.

// Validates and cleans the fields of an event. With partial=true only the fields that were sent are returned.
export type EventFields = Partial<Pick<Event, "title" | "day" | "allDay" | "startTime" | "endTime" | "category" | "repeat" | "repeatUntil" | "location" | "notes" | "remindMin">>;
export function cleanEvent(b: UncheckedJson, partial?: false): Cleaned<EventFields & Pick<Event, "title" | "day">>;
export function cleanEvent(b: UncheckedJson, partial: true): Cleaned<EventFields>;
export function cleanEvent(b: UncheckedJson, partial = false): Cleaned<EventFields> {
  const d: EventFields = {};
  const has = (k: string) => b[k] !== undefined;
  if (!partial || has("title")) {
    if (!String(b.title || "").trim()) return { error: "Give the event a title." };
    d.title = String(b.title).trim().slice(0, 160);
  }
  if (!partial || has("day")) {
    if (!DAY_RE.test(b.day || "")) return { error: "Pick a valid date." };
    d.day = b.day;
  }
  if (has("allDay")) d.allDay = !!b.allDay;
  if (d.allDay) { d.startTime = ""; d.endTime = ""; }
  else {
    for (const k of ["startTime", "endTime"] as const) {
      if (!has(k)) continue;
      if (b[k] !== "" && !TIME_RE.test(b[k])) return { error: "Times look like 14:30." };
      d[k] = b[k];
    }
    if (d.startTime && d.endTime && toMin(d.endTime) <= toMin(d.startTime)) return { error: "The end must be after the start." };
    if (!partial && !d.startTime && !has("allDay")) d.allDay = true;
  }
  if (has("category")) d.category = CATEGORIES.includes(b.category) ? b.category : "event";
  if (has("repeat")) d.repeat = REPEATS.includes(b.repeat) ? b.repeat : "none";
  if (has("repeatUntil")) {
    if (b.repeatUntil && !DAY_RE.test(b.repeatUntil)) return { error: "Pick a valid end date for the repeat." };
    d.repeatUntil = b.repeatUntil || "";
  }
  if (has("location")) d.location = String(b.location || "").slice(0, 200);
  if (has("notes")) d.notes = String(b.notes || "").slice(0, 4000);
  if (has("remindMin")) {
    const n = Number(b.remindMin);
    d.remindMin = Number.isFinite(n) && n >= 0 && n <= 10080 ? Math.round(n) : -1;
  }
  return { data: d };
}

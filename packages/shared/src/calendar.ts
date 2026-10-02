import { z } from "zod";
import { Day, Id, IsoDateTime } from "./primitives.ts";

// The calendar (P2-12). Days are local "YYYY-MM-DD" strings and times "HH:mm", so an event means the same thing in the
// website, the reminders and the .ics export. The detailed checks compare fields with each other and live in the API
// (modules/calendar/event-rules.ts); these schemas describe and document the shapes.

/** An event as stored. A repeating event is one row; `exceptions` lists the days skipped ("YYYY-MM-DD,YYYY-MM-DD"). */
export const CalendarEvent = z.object({
  id: Id,
  title: z.string(),
  day: Day,
  startTime: z.string(),
  endTime: z.string(),
  notes: z.string(),
  category: z.string(),
  allDay: z.boolean(),
  location: z.string(),
  repeat: z.string(),
  repeatUntil: z.string(),
  exceptions: z.string(),
  /** Minutes before the start to remind her, -1 = no reminder. */
  remindMin: z.number().int(),
  createdAt: IsoDateTime,
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

/** The fields she can send for an event (checked by the API's event rules). */
export const EventFields = z
  .looseObject({
    title: z.string(), day: z.string(), allDay: z.boolean(),
    startTime: z.string(), endTime: z.string(), category: z.string(), repeat: z.string(), repeatUntil: z.string(),
    location: z.string(), notes: z.string(), remindMin: z.number(),
  })
  .partial();

/** POST /api/events/:id/skip: the one day of a repeating event to leave out. */
export const SkipDayInput = z.object({ day: z.string({ error: "Pick a valid date." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.") });

/** GET /api/calendar */
export const CalendarRangeQuery = z.object({ from: z.string().optional(), to: z.string().optional() });

/** POST /api/calendar/parse */
export const ParseEventInput = z.object({
  text: z.preprocess((v) => String(v || ""), z.string().refine((s) => s.trim().length > 0, "Type what you want to add, like: study Friday 3pm for 1h.")),
});

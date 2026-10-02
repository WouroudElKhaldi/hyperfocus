import { z } from "zod";
import { REMINDER_REPEATS } from "./constants.ts";
import { Id, IsoDateTime } from "./primitives.ts";

// Reminders she writes herself ("My reminders"). The rules are the ones the API used before P2-13: text is trimmed and
// cut to length (anything sent is turned into text), and the first problem found is the one reported.

/** A reminder as stored. `done` = a one-off that has fired; `lastFiredAt` = when it last popped up. */
export const Reminder = z.object({
  id: Id,
  title: z.string(),
  note: z.string(),
  at: IsoDateTime,
  repeat: z.enum(REMINDER_REPEATS),
  done: z.boolean(),
  lastFiredAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type Reminder = z.infer<typeof Reminder>;

const asText = (max: number) => (v: unknown) => (v === undefined ? undefined : String(v ?? "").trim().slice(0, max));
const title = z.preprocess(asText(120), z.string({ error: "Say what to remind you about." }).min(1, "Say what to remind you about."));
// a time the browser sends ("2026-10-02T09:00" or a full ISO string); empty or impossible ones are refused
const at = z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date({ error: "Pick a day and time." }));
const repeat = z.enum(REMINDER_REPEATS, { error: "That repeat isn't available." });
const note = z.preprocess(asText(300), z.string().optional());

/** POST /api/reminders */
export const CreateReminderInput = z.object({ title, at, repeat: repeat.optional(), note });
export type CreateReminderInput = z.input<typeof CreateReminderInput>;

/** PATCH /api/reminders/:id. Only the fields sent change. */
export const UpdateReminderInput = z.object({ title: title.optional(), at: at.optional(), repeat: repeat.optional(), note });
export type UpdateReminderInput = z.input<typeof UpdateReminderInput>;

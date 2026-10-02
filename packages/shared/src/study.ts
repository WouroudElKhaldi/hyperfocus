import { z } from "zod";
import { Id, IsoDateTime } from "./primitives.ts";

// Study sessions (the study log and its timer). The rules are the ones the API used before P2-10.

/** endedAt null = running; pausedAt set = on a break. breakMs = time spent on breaks, not counted as study. */
export const StudySession = z.object({
  id: Id,
  course: z.string(),
  part: z.string(),
  notes: z.string(),
  startedAt: IsoDateTime,
  endedAt: IsoDateTime.nullable(),
  breakMs: z.number().int(),
  pausedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type StudySession = z.infer<typeof StudySession>;

// a time the browser sends; empty means "not given", anything else must be a real time
const time = (error: string) => z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date({ error }).optional());
// minutes of break: anything that isn't a positive number counts as 0
const minutes = z.preprocess((v) => (v === undefined ? undefined : Math.max(0, Math.round(Number(v) || 0))), z.number().optional());

/** POST /api/study: start the timer (no times), or log a past session (startedAt and endedAt, maybe breakMins). */
export const CreateStudyInput = z.object({
  course: z.string().default(""),
  part: z.string().default(""),
  notes: z.string().default(""),
  startedAt: time("Invalid start time."),
  endedAt: time("Invalid end time."),
  breakMins: minutes,
});
export type CreateStudyInput = z.input<typeof CreateStudyInput>;

/** PATCH /api/study/:id: only what is sent changes. */
export const UpdateStudyInput = z.object({
  course: z.string().optional(),
  part: z.string().optional(),
  notes: z.string().optional(),
  startedAt: time("Invalid time."),
  endedAt: time("Invalid time."),
  breakMins: minutes,
});
export type UpdateStudyInput = z.input<typeof UpdateStudyInput>;

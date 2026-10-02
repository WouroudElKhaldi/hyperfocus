import { z } from "zod";

// The reminder settings (P2-20). Same rules as before: a value of the wrong type, or a time that isn't HH:MM, is quietly
// ignored (the old setting stays), and the break reminder is kept between 15 and 180 minutes.

export const Settings = z.object({
  /** Desktop reminders on or off. */
  reminders: z.boolean(),
  /** Remind to take a break after this many minutes of studying (15–180). */
  breakEveryMin: z.number().int(),
  /** When the morning reminder comes, "HH:MM". */
  morningAt: z.string(),
});
export type Settings = z.infer<typeof Settings>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const only = <T>(keep: (v: unknown) => v is T, fix: (v: T) => T = (v) => v) => (v: unknown) => (keep(v) ? fix(v) : undefined);

/** PATCH /api/settings. Only the fields sent (and valid) change. */
export const UpdateSettingsInput = z.object({
  reminders: z.preprocess(only((v): v is boolean => typeof v === "boolean"), z.boolean().optional()),
  breakEveryMin: z.preprocess(
    only((v): v is number => typeof v === "number" && Number.isFinite(v), (n) => Math.min(180, Math.max(15, Math.round(n)))),
    z.number().int().optional(),
  ),
  morningAt: z.preprocess(only((v): v is string => typeof v === "string" && TIME.test(v)), z.string().optional()),
});
export type UpdateSettingsInput = z.input<typeof UpdateSettingsInput>;

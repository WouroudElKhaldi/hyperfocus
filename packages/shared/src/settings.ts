import { z } from "zod";
import { FONT_CHOICES, MOTION_CHOICES, TEXT_SIZES } from "./constants.ts";

// The reminder settings (P2-20) and the accessibility settings (P3-18). Same rules as before: a value of the wrong type, or a time that isn't HH:MM, is quietly
// ignored (the old setting stays), and the break reminder is kept between 15 and 180 minutes.

export const Settings = z.object({
  /** Desktop reminders on or off. */
  reminders: z.boolean(),
  /** Remind to take a break after this many minutes of studying (15–180). */
  breakEveryMin: z.number().int(),
  /** When the morning reminder comes, "HH:MM". */
  morningAt: z.string(),
  /** Movement on screen: follow the computer's setting, or always calm (no animations). */
  motion: z.enum(MOTION_CHOICES),
  /** The app's usual fonts, or an easy-to-read one (Atkinson Hyperlegible). */
  font: z.enum(FONT_CHOICES),
  /** Text size: normal, large (112.5%) or larger (125%). */
  textSize: z.enum(TEXT_SIZES),
  /** Focus mode: the sidebar is hidden, so only the page is on screen. */
  focusMode: z.boolean(),
});
export type Settings = z.infer<typeof Settings>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const oneOf = <T extends string>(list: readonly T[]) => (v: unknown): v is T => list.includes(v as T);
const only = <T>(keep: (v: unknown) => v is T, fix: (v: T) => T = (v) => v) => (v: unknown) => (keep(v) ? fix(v) : undefined);

/** PATCH /api/settings. Only the fields sent (and valid) change. */
export const UpdateSettingsInput = z.object({
  reminders: z.preprocess(only((v): v is boolean => typeof v === "boolean"), z.boolean().optional()),
  breakEveryMin: z.preprocess(
    only((v): v is number => typeof v === "number" && Number.isFinite(v), (n) => Math.min(180, Math.max(15, Math.round(n)))),
    z.number().int().optional(),
  ),
  morningAt: z.preprocess(only((v): v is string => typeof v === "string" && TIME.test(v)), z.string().optional()),
  motion: z.preprocess(only(oneOf(MOTION_CHOICES)), z.enum(MOTION_CHOICES).optional()),
  font: z.preprocess(only(oneOf(FONT_CHOICES)), z.enum(FONT_CHOICES).optional()),
  textSize: z.preprocess(only(oneOf(TEXT_SIZES)), z.enum(TEXT_SIZES).optional()),
  focusMode: z.preprocess(only((v): v is boolean => typeof v === "boolean"), z.boolean().optional()),
});
export type UpdateSettingsInput = z.input<typeof UpdateSettingsInput>;

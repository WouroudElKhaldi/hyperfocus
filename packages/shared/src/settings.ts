import { z } from "zod";
import { FONT_CHOICES, MOTION_CHOICES, TEXT_SIZES } from "./constants.ts";

// The reminder settings (P2-20) and the accessibility settings (P3-18). Same rules as before: a value of the wrong type, or a time that isn't HH:MM, is quietly
// ignored (the old setting stays), and the break reminder is kept between 15 and 180 minutes.

/** P3-27: the menu as you arranged it: your groups (a standard group keeps its id and may get a name of yours), the
 * pages in each, in order, and the pages you hid. Pages it doesn't list stay in their usual group. */
export const MenuLayout = z.object({
  groups: z.array(z.object({ id: z.string().regex(/^[A-Za-z0-9-]{1,24}$/), name: z.string().trim().max(30), items: z.array(z.string().regex(/^\/[a-z-]*$/)).max(40) })).max(10),
  hidden: z.array(z.string().regex(/^\/[a-z-]*$/)).max(40),
});
export type MenuLayout = z.infer<typeof MenuLayout>;

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
  /** Notifications (P5-11): pop-ups on this computer (local mode only). */
  desktop: z.boolean(),
  /** Web push on your devices (P5-11). */
  push: z.boolean(),
  /** A daily email with the day's notifications, at digestAt (P5-11). */
  emailDigest: z.boolean(),
  digestAt: z.string(),
  /** Quiet hours "HH:MM"–"HH:MM" (over midnight is fine): nothing pops up; everything is still in the bell. Empty = none. */
  quietFrom: z.string(),
  quietTo: z.string(),
  /** Your time zone, like "Asia/Beirut" (empty = the server's). Set by the website from your device. */
  timeZone: z.string(),
  /** Delete AI chats (Talk, book questions) older than this many days (P5-12); 0 = keep them. */
  chatKeepDays: z.number().int(),
  /** P3-27: your menu (null = the standard one) */
  menu: MenuLayout.nullable(),
});
export type Settings = z.infer<typeof Settings>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const knownTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.length <= 64;
  } catch {
    return false;
  }
};
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
  desktop: z.preprocess(only((v): v is boolean => typeof v === "boolean"), z.boolean().optional()),
  push: z.preprocess(only((v): v is boolean => typeof v === "boolean"), z.boolean().optional()),
  emailDigest: z.preprocess(only((v): v is boolean => typeof v === "boolean"), z.boolean().optional()),
  digestAt: z.preprocess(only((v): v is string => typeof v === "string" && TIME.test(v)), z.string().optional()),
  quietFrom: z.preprocess(only((v): v is string => typeof v === "string" && (v === "" || TIME.test(v))), z.string().optional()),
  quietTo: z.preprocess(only((v): v is string => typeof v === "string" && (v === "" || TIME.test(v))), z.string().optional()),
  timeZone: z.preprocess(only((v): v is string => typeof v === "string" && (v === "" || knownTimeZone(v))), z.string().optional()),
  chatKeepDays: z.preprocess(only((v): v is number => v === 0 || v === 30 || v === 90 || v === 365), z.number().int().optional()),
  // (null = back to the standard menu; a layout that doesn't fit the rules is ignored, like the other fields)
  menu: z.preprocess((v) => (v === null ? null : MenuLayout.safeParse(v).success ? v : undefined), MenuLayout.nullable().optional()),
});
export type UpdateSettingsInput = z.input<typeof UpdateSettingsInput>;

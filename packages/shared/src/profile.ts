import { z } from "zod";
import { IsoDateTime } from "./primitives.ts";

// The person using the app (P2-20). The rules are the ones the API used before: every field is turned into text,
// trimmed and cut to length; an email, LinkedIn link or avatar color that is sent must look right, and the first
// problem found is the one reported (email, then LinkedIn, then the avatar).

export const PROFILE_MAX = { name: 60, role: 80, location: 80, email: 120, linkedin: 200, about: 600, helps: 800, major: 100, school: 100, neuroNote: 300 } as const;

// P5-14, the longer welcome guide: the choices for "about me". Each is optional; "" (or an empty list) means not said.
export const PRONOUNS = ["she", "he", "they"] as const;
export const STUDY_LEVELS = ["school", "diploma", "bachelor", "master", "phd", "bootcamp", "self", "none"] as const;
export const STUDY_YEARS = ["1", "2", "3", "4", "5", "6", "last"] as const;
export const SITUATIONS = ["studying", "working", "both", "looking", "other"] as const;
/** How their brain works: only what they choose to say. It fits the AI's help to them and is never shown to anyone. */
export const NEURO = ["adhd", "autism", "dyslexia", "dyscalculia", "dyspraxia", "anxiety", "depression", "ocd", "bipolar", "ptsd", "chronic", "unsure"] as const;
export const SUPPORTS = ["smallSteps", "reminders", "timers", "checklists", "examples", "bodyDouble", "breaks", "routine", "quiet", "visual", "deadlines", "rewards"] as const;
export const TONES = ["gentle", "direct", "playful"] as const;
export const BEST_TIMES = ["morning", "afternoon", "evening", "night"] as const;
export const FOCUS_MINUTES = [5, 10, 15, 25, 45, 60] as const;
export const DEFAULT_AVATAR = "#7447e6";

/** The profile as stored. Before anything is saved, the API answers an empty one (no id). */
export const Profile = z.object({
  id: z.number().int().positive().optional(),
  name: z.string(),
  role: z.string(),
  location: z.string(),
  email: z.string(),
  linkedin: z.string(),
  about: z.string(),
  /** "What helps me": shared only with the AI companion, to fit its replies. */
  helps: z.string(),
  /** the standard occupation of their job title (or the job they want): skills are suggested for it; "" = none */
  occupationCode: z.string(),
  pronouns: z.string(),
  studyLevel: z.string(),
  major: z.string(),
  school: z.string(),
  studyYear: z.string(),
  situation: z.string(),
  neuro: z.array(z.string()),
  neuroNote: z.string(),
  supports: z.array(z.string()),
  tone: z.string(),
  bestTime: z.string(),
  focusMins: z.number().int(),
  avatar: z.string(),
  updatedAt: IsoDateTime.optional(),
});
export type Profile = z.infer<typeof Profile>;

const text = (max: number) => z.preprocess((v) => (v === undefined ? undefined : String(v).trim().slice(0, max)), z.string().optional());
const checkedText = (max: number, re: RegExp, error: string) =>
  z.preprocess((v) => (v === undefined ? undefined : String(v).trim().slice(0, max)), z.string().refine((s) => !s || re.test(s), { error }).optional());

const oneOf = <T extends readonly [string, ...string[]]>(list: T) => z.union([z.enum(list), z.literal("")]).optional();
const someOf = <T extends readonly [string, ...string[]]>(list: T) => z.array(z.enum(list)).max(list.length).transform((a) => [...new Set(a)]).optional();

/** The "about me" answers (welcome guide and Profile). Only the fields sent change. */
export const AboutMeInput = z.object({
  pronouns: oneOf(PRONOUNS),
  studyLevel: oneOf(STUDY_LEVELS),
  major: text(PROFILE_MAX.major),
  school: text(PROFILE_MAX.school),
  studyYear: oneOf(STUDY_YEARS),
  situation: oneOf(SITUATIONS),
  neuro: someOf(NEURO),
  neuroNote: text(PROFILE_MAX.neuroNote),
  supports: someOf(SUPPORTS),
  tone: oneOf(TONES),
  bestTime: oneOf(BEST_TIMES),
  focusMins: z.number().int().refine((n) => n === 0 || (FOCUS_MINUTES as readonly number[]).includes(n), { error: "Pick one of the times." }).optional(),
});
export type AboutMeInput = z.input<typeof AboutMeInput>;

/** PUT /api/profile. Only the fields sent change. */
export const UpdateProfileInput = z.object({
  email: checkedText(PROFILE_MAX.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That email doesn't look right."),
  linkedin: checkedText(PROFILE_MAX.linkedin, /^https?:\/\/\S+\.\S+/, "The LinkedIn link should start with https://"),
  avatar: z
    .string({ error: "Pick a color for your avatar." })
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a color for your avatar.")
    .transform((s) => s.toLowerCase())
    .optional(),
  name: text(PROFILE_MAX.name),
  role: text(PROFILE_MAX.role),
  location: text(PROFILE_MAX.location),
  about: text(PROFILE_MAX.about),
  helps: text(PROFILE_MAX.helps),
  occupationCode: z.string().regex(/^((onet|esco|local):\S{1,100})?$/, "Pick a job from the list.").optional(),
  ...AboutMeInput.shape,
});
export type UpdateProfileInput = z.input<typeof UpdateProfileInput>;

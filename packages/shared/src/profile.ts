import { z } from "zod";
import { IsoDateTime } from "./primitives.ts";

// The person using the app (P2-20). The rules are the ones the API used before: every field is turned into text,
// trimmed and cut to length; an email, LinkedIn link or avatar color that is sent must look right, and the first
// problem found is the one reported (email, then LinkedIn, then the avatar).

export const PROFILE_MAX = { name: 60, role: 80, location: 80, email: 120, linkedin: 200, about: 600, helps: 800 } as const;
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
  avatar: z.string(),
  updatedAt: IsoDateTime.optional(),
});
export type Profile = z.infer<typeof Profile>;

const text = (max: number) => z.preprocess((v) => (v === undefined ? undefined : String(v).trim().slice(0, max)), z.string().optional());
const checkedText = (max: number, re: RegExp, error: string) =>
  z.preprocess((v) => (v === undefined ? undefined : String(v).trim().slice(0, max)), z.string().refine((s) => !s || re.test(s), { error }).optional());

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
});
export type UpdateProfileInput = z.input<typeof UpdateProfileInput>;

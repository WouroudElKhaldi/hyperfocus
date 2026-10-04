// Plain values both apps agree on. No Zod here, so the website can import these without bundling Zod.

/** The kinds a note can have. (The API currently stores any string; P2 restricts it to these.) */
export const NOTE_KINDS = ["thought", "note", "post_idea", "project_idea"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** How important a task is. More important tasks earn the companion pet more points. */
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Pet points for finishing a task, by priority. The API awards these and the website shows them. */
// (P3-24, interview 1: simple tasks earned too much) a small base by importance, and the effort on top: each of the
// task's steps done adds STEP_POINT, up to MAX_STEP_POINTS
export const TASK_PRIORITY_POINTS = { low: 1, normal: 3, high: 6, urgent: 10 } as const satisfies Record<TaskPriority, number>;
export const STEP_POINT = 1;
export const MAX_STEP_POINTS = 6;

/** How a reminder you write yourself can repeat. */
export const REMINDER_REPEATS = ["none", "daily", "weekdays", "weekly"] as const;
export type ReminderRepeat = (typeof REMINDER_REPEATS)[number];

/** The companion pet's species. The API checks them and the website draws them (PetArt). */
export const PET_SPECIES = ["cat", "fox", "bunny", "dragon", "blob"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

/** The pet can be a boy, a girl, or either: it changes its build and which clothes fit (items marked for one). */
export const PET_GENDERS = ["boy", "girl", "neutral"] as const;
export type PetGender = (typeof PET_GENDERS)[number];

/** The pet's ages: 0 is the egg, 9 the last form (a legend is age 9 with a glow). */
export const PET_AGE_COUNT = 10;

/** Accessibility settings (P3-18): movement, font and text size. "auto" motion follows the computer's setting. */
export const MOTION_CHOICES = ["auto", "reduce"] as const;
export const FONT_CHOICES = ["default", "readable"] as const;
export const TEXT_SIZES = ["normal", "large", "larger"] as const;
export type MotionChoice = (typeof MOTION_CHOICES)[number];
export type FontChoice = (typeof FONT_CHOICES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];

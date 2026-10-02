// Plain values both apps agree on. No Zod here, so the website can import these without bundling Zod.

/** The kinds a note can have. (The API currently stores any string; P2 restricts it to these.) */
export const NOTE_KINDS = ["thought", "note", "post_idea", "project_idea"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** How important a task is. More important tasks earn the companion pet more points. */
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Pet points for finishing a task, by priority. The API awards these and the website shows them. */
export const TASK_PRIORITY_POINTS = { low: 2, normal: 4, high: 8, urgent: 14 } as const satisfies Record<TaskPriority, number>;

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

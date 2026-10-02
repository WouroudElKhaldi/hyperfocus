// Plain values both apps agree on. No Zod here, so the website can import these without bundling Zod.

/** The kinds a note can have. (The API currently stores any string; P2 restricts it to these.) */
export const NOTE_KINDS = ["thought", "note", "post_idea", "project_idea"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** How important a task is. More important tasks earn the companion pet more points. */
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Pet points for finishing a task, by priority. The API awards these and the website shows them. */
export const TASK_PRIORITY_POINTS = { low: 2, normal: 4, high: 8, urgent: 14 } as const satisfies Record<TaskPriority, number>;

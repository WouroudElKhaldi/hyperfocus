import { z } from "zod";
import { TASK_PRIORITIES } from "./constants.ts";
import { Id, IsoDateTime, nonBlank } from "./primitives.ts";

// Tasks and their steps. These describe the API exactly as it behaves today (P1-04);
// P2 starts validating requests with them.

export const TaskPriorityEnum = z.enum(TASK_PRIORITIES);

export const Step = z.object({
  id: Id,
  text: z.string(),
  done: z.boolean(),
  taskId: Id,
});
export type Step = z.infer<typeof Step>;

/** A task as the API returns it, steps included (oldest step first). */
export const Task = z.object({
  id: Id,
  title: z.string(),
  done: z.boolean(),
  today: z.boolean(),
  createdAt: IsoDateTime,
  doneAt: IsoDateTime.nullable(),
  dueDay: z.string().nullable(), // "YYYY-MM-DD" in practice; the API doesn't check the format yet
  priority: TaskPriorityEnum,
  steps: z.array(Step),
});
export type Task = z.infer<typeof Task>;

/** POST /api/tasks. A missing or unknown priority quietly becomes "normal". */
export const CreateTaskInput = z.object({
  title: nonBlank("Task needs a title."),
  today: z.boolean().optional(),
  dueDay: z.string().nullish(),
  priority: TaskPriorityEnum.catch("normal"),
});
export type CreateTaskInput = z.input<typeof CreateTaskInput>;

/** PATCH /api/tasks/:id. Unlike create, an unknown priority is refused here. */
export const UpdateTaskInput = z.object({
  title: z.string(),
  done: z.boolean(),
  today: z.boolean(),
  dueDay: z.string().nullable(),
  priority: z.enum(TASK_PRIORITIES, { error: "Importance must be low, normal, high or urgent." }),
}).partial();
export type UpdateTaskInput = z.input<typeof UpdateTaskInput>;

/** POST /api/tasks/:id/steps: several steps at once, or one. Empty ones are skipped. */
export const AddStepsInput = z.union([z.object({ steps: z.array(z.string()) }), z.object({ text: z.string() })]);
export type AddStepsInput = z.input<typeof AddStepsInput>;

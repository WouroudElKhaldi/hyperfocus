import { z } from "zod";
import { Id, IsoDateTime, nonBlank } from "./primitives.ts";

// Goals: the what (original, refined by the AI), the when (targetDate), the how (actions) and progress (logs).
// The rules are the ones the API used before P2-08.

export const GoalAction = z.object({ id: Id, text: z.string(), done: z.boolean(), goalId: Id });
export type GoalAction = z.infer<typeof GoalAction>;
export const GoalLog = z.object({ id: Id, text: z.string(), createdAt: IsoDateTime, goalId: Id });
export type GoalLog = z.infer<typeof GoalLog>;

/** A goal with its actions (oldest first) and logs (newest first). verdict: achievable | stretch | unrealistic, or "". */
export const Goal = z.object({
  id: Id,
  original: z.string(),
  refined: z.string(),
  targetDate: IsoDateTime.nullable(),
  status: z.string(), // active | achieved | paused
  verdict: z.string(),
  verdictNote: z.string(),
  suggestion: z.string(),
  analyzedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  actions: z.array(GoalAction),
  logs: z.array(GoalLog),
});
export type Goal = z.infer<typeof Goal>;

// a date the browser sends; empty means "no date", anything that isn't a date is refused
const targetDate = z.preprocess((v) => (v ? new Date(v as string) : null), z.date({ error: "Invalid date." }).nullable());

/** POST /api/goals */
export const CreateGoalInput = z.object({ original: nonBlank("Write your goal first."), targetDate: targetDate.optional() });
export type CreateGoalInput = z.input<typeof CreateGoalInput>;

/** PATCH /api/goals/:id. Sending targetDate empty clears it. */
export const UpdateGoalInput = z.object({ original: z.string(), refined: z.string(), status: z.string(), targetDate }).partial();
export type UpdateGoalInput = z.input<typeof UpdateGoalInput>;

/** POST /api/goals/:id/actions: several at once (texts) or one (text). Blank ones are skipped. */
export const AddGoalActionsInput = z.object({ texts: z.array(z.string()), text: z.string() }).partial();
export type AddGoalActionsInput = z.input<typeof AddGoalActionsInput>;

/** PATCH /api/goal-actions/:id */
export const UpdateGoalActionInput = z.object({ done: z.boolean(), text: z.string() }).partial();
export type UpdateGoalActionInput = z.input<typeof UpdateGoalActionInput>;

/** POST /api/goals/:id/logs */
export const AddGoalLogInput = z.object({ text: nonBlank("Write what you did.") });
export type AddGoalLogInput = z.input<typeof AddGoalLogInput>;

/** POST /api/goals/:id/analyze: the goal with the AI's verdict saved, and the steps it suggests (not saved yet). */
export const GoalAnalysis = z.object({ goal: Goal, actions: z.array(z.string()) });
export type GoalAnalysis = z.infer<typeof GoalAnalysis>;

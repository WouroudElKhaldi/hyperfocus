import { z } from "zod";
import { Id, IsoDateTime, nonBlank } from "./primitives.ts";

// Wins (P2-14): the ones she writes down, plus everything she finished (tasks, posts, study of 5+ minutes), shown as one
// timeline. And the weekly review: numbers from her own data, written up by the AI.

export const Win = z.object({ id: Id, text: z.string(), createdAt: IsoDateTime });
export type Win = z.infer<typeof Win>;

/** One line of the wins timeline. `winId` is set only for the wins she wrote herself (those can be deleted). */
export const WinItem = z.object({
  id: z.string(),
  kind: z.enum(["win", "task", "post", "study"]),
  text: z.string(),
  date: IsoDateTime,
  manual: z.boolean().optional(),
  winId: Id.optional(),
});
export type WinItem = z.infer<typeof WinItem>;

/** POST /api/wins. The text is trimmed. */
export const CreateWinInput = z.object({ text: nonBlank("Write what you did.").transform((s) => s.trim()) });
export type CreateWinInput = z.input<typeof CreateWinInput>;

export const WinsSummary = z.object({ bullets: z.array(z.string()), paragraph: z.string() });
export type WinsSummary = z.infer<typeof WinsSummary>;

/** The week in numbers, from her own data (the AI never makes these up). Minutes are active study time. */
export const ReviewStats = z.object({
  studyMinutes: z.number(), studyMinutesLastWeek: z.number(), studySessions: z.number(), studyDays: z.number(),
  tasksDone: z.number(), tasksOpen: z.number(), tasksOverdue: z.number(), goalStepsDone: z.number(), goalUpdates: z.number(),
  postsPublished: z.number(), draftsWaiting: z.number(), scheduled: z.number(),
});

/** A saved weekly review: `stats` are computed from her data, `content` is the AI's write-up. */
export const Review = z.object({
  id: Id,
  label: z.string(),
  createdAt: IsoDateTime,
  stats: ReviewStats,
  content: z.object({
    headline: z.string(),
    wins: z.array(z.string()),
    watch: z.array(z.string()),
    priorities: z.array(z.object({ title: z.string(), why: z.string() })),
    tinyStart: z.string(),
    postIdea: z.string(),
  }),
});
export type Review = z.infer<typeof Review>;

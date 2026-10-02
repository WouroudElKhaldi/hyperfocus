import { z } from "zod";
import { Id, IsoDateTime, nonBlank } from "./primitives.ts";

// LinkedIn posts (P2-15): a thought, the draft the AI helps write, and where it is on its way to LinkedIn.
// The rules are the ones the API used before.

/** draft | scheduled | posting (being sent right now) | posted | failed | missed (the app was closed at the time) */
export const POST_STATUSES = ["draft", "scheduled", "posting", "posted", "failed", "missed"] as const;

export const Post = z.object({
  id: Id,
  thought: z.string(),
  draft: z.string(),
  status: z.string(),
  postedAt: IsoDateTime.nullable(),
  scheduledAt: IsoDateTime.nullable(),
  attempts: z.number().int(),
  lastError: z.string(),
  lastAttemptAt: IsoDateTime.nullable(),
  noteId: Id.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Post = z.infer<typeof Post>;

/** POST /api/posts. A post can start from a captured note (noteId). */
export const CreatePostInput = z.object({ thought: nonBlank("Write your thought first."), draft: z.string().optional(), noteId: Id.nullable().optional() });
export type CreatePostInput = z.input<typeof CreatePostInput>;

/** PATCH /api/posts/:id. Only the fields sent change. */
export const UpdatePostInput = z.object({ thought: z.string(), draft: z.string() }).partial();
export type UpdatePostInput = z.input<typeof UpdatePostInput>;

/** POST /api/posts/:id/schedule. The time is checked by the API (it must be a real time, a minute or more from now). */
export const SchedulePostInput = z.object({ scheduledAt: z.union([z.string(), z.number()]).optional() });
export type SchedulePostInput = z.input<typeof SchedulePostInput>;

// ---------- the AI helpers for posts ----------
/** POST /api/ai/rewrite: a first draft from her thought, or an edit of the draft following her instruction. */
export const RewriteInput = z.object({ thought: nonBlank("No thought to rewrite."), draft: z.string().optional(), instruction: z.string().optional() });
export type RewriteInput = z.input<typeof RewriteInput>;
export const Rewrite = z.object({ draft: z.string(), hookType: z.string(), hooks: z.array(z.string()), suggestions: z.array(z.string()) });

/** POST /api/ai/polish: the smallest fixes. Accepts the text as `text` or `draft`. */
export const PolishInput = z
  .object({ text: z.string().optional(), draft: z.string().optional() })
  .transform((b) => b.text ?? b.draft ?? "")
  .refine((t) => t.trim().length > 0, "There is nothing to polish.");
export type PolishInput = z.input<typeof PolishInput>;
export const Polished = z.object({ draft: z.string(), changes: z.array(z.string()) });

/** POST /api/ai/post-ideas: 3 post ideas from study notes (at least 15 characters of notes). */
export const PostIdeasInput = z.object({
  course: z.string().optional().default(""),
  part: z.string().optional().default(""),
  notes: z
    .string()
    .optional()
    .default("")
    .refine((n) => n.trim().length >= 15, "Write a few more notes first, so there's something to build a post from.")
    .transform((n) => n.slice(0, 4000)),
});
export type PostIdeasInput = z.input<typeof PostIdeasInput>;
export const PostIdeas = z.object({ ideas: z.array(z.object({ angle: z.string(), thought: z.string() })) });

import { z } from "zod";
import { Id, IsoDateTime, nonBlank } from "./primitives.ts";

// Books she wants to read, is reading or finished (P2-11), and her questions to the AI about one book.
// The rules are the ones the API used before.

/** want | reading | done */
export const BOOK_STATUSES = ["want", "reading", "done"] as const;

export const Book = z.object({
  id: Id,
  title: z.string(),
  author: z.string(),
  status: z.string(),
  notes: z.string(),
  /** The last "find free copies" search, as JSON text ("" before the first one). */
  result: z.string(),
  foundAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type Book = z.infer<typeof Book>;

export const BookMessage = z.object({ id: Id, bookId: Id, role: z.enum(["user", "assistant"]), content: z.string(), createdAt: IsoDateTime });
export type BookMessage = z.infer<typeof BookMessage>;

/** POST /api/books. Title and author are trimmed. */
export const CreateBookInput = z.object({
  title: nonBlank("Write the book's title.").transform((s) => s.trim()),
  author: z.string().optional().transform((s) => (s ?? "").trim()),
  notes: z.string().optional(),
});
export type CreateBookInput = z.input<typeof CreateBookInput>;

/** PATCH /api/books/:id. Only the fields sent change. */
export const UpdateBookInput = z.object({ title: z.string(), author: z.string(), status: z.string(), notes: z.string() }).partial();
export type UpdateBookInput = z.input<typeof UpdateBookInput>;

/** POST /api/books/:id/ask. The question is trimmed and cut to 1500 characters. */
export const AskBookInput = z.object({
  question: z.preprocess((v) => String(v || "").trim().slice(0, 1500), z.string().min(1, "Write your question first.")),
});
export type AskBookInput = z.input<typeof AskBookInput>;

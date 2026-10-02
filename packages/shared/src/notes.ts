import { z } from "zod";
import { Id, IsoDateTime, nonBlank } from "./primitives.ts";

// Notes ("Thoughts & ideas"). These describe the API exactly as it behaves today (P1-04);
// P2 starts validating requests with them.

/** A note as stored. `kind` is any string for now (see NOTE_KINDS for the ones the website offers). */
export const Note = z.object({
  id: Id,
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  pinned: z.boolean(),
  archived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Note = z.infer<typeof Note>;

/** A note in GET /api/notes, with the posts made from it. `posted` = one of them is published. */
export const NoteListItem = Note.extend({
  postIds: z.array(Id),
  posted: z.boolean(),
});
export type NoteListItem = z.infer<typeof NoteListItem>;

/** POST /api/notes */
export const CreateNoteInput = z.object({
  kind: z.string().default("thought"),
  title: z.string().default(""),
  body: nonBlank("Write something first."),
});
export type CreateNoteInput = z.input<typeof CreateNoteInput>;

/** PATCH /api/notes/:id. Every field is optional; only the ones sent change. */
export const UpdateNoteInput = z.object({
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  pinned: z.boolean(),
  archived: z.boolean(),
}).partial();
export type UpdateNoteInput = z.input<typeof UpdateNoteInput>;

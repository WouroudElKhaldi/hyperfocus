import { z } from "@hono/zod-openapi";
import { CreateNoteInput, Note, NoteListItem, UpdateNoteInput } from "@hyperfocus/shared";
import type { AppDeps } from "../../app.ts";
import { crudRouter } from "../../http/crud.ts";
import { awardCapture } from "../../pet.ts";
import { compact, orNull } from "../../types.ts";

// Notes ("Thoughts & ideas"), the first module on Hono (P2-06). Same answers as the Express routes had, with two fixes
// planned for P2: a missing id is a 404 "Note not found." instead of a 500, and a wrongly typed field is a 400.

export function notesRouter({ prisma }: AppDeps) {
  return crudRouter({
    path: "/api/notes",
    tag: "Notes",
    name: "note",
    item: Note,
    listItem: NoteListItem,
    listQuery: z.object({ kind: z.string().optional().openapi({ description: "Only notes of this kind, like post_idea" }) }),
    create: CreateNoteInput,
    update: UpdateNoteInput,
    notFound: "Note not found.",
    store: {
      list: async ({ kind }) => {
        const notes = await prisma.note.findMany({
          where: kind ? { kind } : {},
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          include: { posts: { select: { id: true, status: true } } },
        });
        // a note counts as "posted" once a post made from it is published
        return notes.map(({ posts, ...n }) => ({ ...n, postIds: posts.map((p) => p.id), posted: posts.some((p) => p.status === "posted") }));
      },
      create: async (data) => {
        const note = await prisma.note.create({ data });
        await awardCapture(prisma, "thought", note.id);
        return note;
      },
      update: (id, data) => orNull(prisma.note.update({ where: { id }, data: compact(data) })),
      remove: async (id) => (await prisma.note.deleteMany({ where: { id } })).count > 0,
    },
  });
}

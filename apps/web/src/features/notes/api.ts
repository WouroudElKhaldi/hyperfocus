import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Thoughts and ideas through the shared cache (P3-07): the Notes page and Today's "Recently saved" share one list,
// pin and archive show at once (and go back if the server says no), and every change refreshes it.

type NoteList = ResponseOf<"get", "/notes">;
const NOTES = keyOf("/notes");

/** Every note, newest first. */
export const useNotes = () => useApi("/notes");

export function useAddNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (note: BodyOf<"post", "/notes">) => api.post("/notes", note),
    onSettled: () => client.invalidateQueries({ queryKey: NOTES }),
  });
}

/** Changes a note (text, kind, pinned, archived). */
export function useUpdateNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: BodyOf<"patch", `/notes/${number}`> }) =>
      api.patch(`/notes/${id}`, change),
    onMutate: ({ id, change }) =>
      optimistic<NoteList>(client, NOTES, (list = []) =>
        list.map((n) => (n.id === id ? ({ ...n, ...change } as typeof n) : n)),
      ),
    onError: (_error, _vars, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: NOTES }),
  });
}

export function useDeleteNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/notes/${id}`),
    onMutate: (id) => optimistic<NoteList>(client, NOTES, (list = []) => list.filter((n) => n.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: NOTES }),
  });
}

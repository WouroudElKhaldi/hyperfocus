import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../api/hooks.ts";
import { keyOf } from "../../api/query.ts";

// The study log through the shared cache (P3-09); the calendar shows the same sessions.

const STUDY = keyOf("/study");

/** Every study session, the running one included. */
export const useStudySessions = () => useApi("/study");

/**
 * A change to the study log (start, pause, stop, edit …): runs `change`, then reloads the sessions and waits for them,
 * so what comes next (like clearing the form after a stop) never sees the old state.
 */
export function useStudyChange<V, R>(change: (vars: V) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSettled: () => Promise.all([STUDY, keyOf("/calendar")].map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

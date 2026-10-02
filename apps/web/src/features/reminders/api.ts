import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Reminders through the shared cache (P3-08): Today's short list and the one in Settings are the same data. The list
// looks again every 30 seconds, because a reminder moves to "Recently sent" on its own when it fires.

type ReminderList = ResponseOf<"get", "/reminders">;
const REMINDERS = keyOf("/reminders");

export const useReminders = () => useApi("/reminders", { refetchInterval: 30_000 });

export function useAddReminder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reminder: BodyOf<"post", "/reminders">) => api.post("/reminders", reminder),
    onSettled: () => client.invalidateQueries({ queryKey: REMINDERS }),
  });
}

/** Moves a reminder to a new time (like "remind me again in 10 minutes"). */
export function useMoveReminder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, at }: { id: number; at: string }) => api.patch(`/reminders/${id}`, { at }),
    onSettled: () => client.invalidateQueries({ queryKey: REMINDERS }),
  });
}

export function useDeleteReminder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/reminders/${id}`),
    onMutate: (id) => optimistic<ReminderList>(client, REMINDERS, (list = []) => list.filter((r) => r.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: REMINDERS }),
  });
}

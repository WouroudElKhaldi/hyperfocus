import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf } from "../../api/query.ts";
import type { BodyOf } from "../../api/typed.ts";

// The calendar through the shared cache (P3-08). Each visible range is cached on its own (going back to last month
// shows it at once), and looks again every minute so the "now" line and finished study sessions stay current.
// Tasks are changed with the tasks feature's hooks, so the Tasks page and Today see a change made here.

/** Everything between two days (inclusive): events, tasks, goals, study sessions, posts. */
export const useCalendar = (from: string, to: string) =>
  useApi(`/calendar?from=${from}&to=${to}`, { refetchInterval: 60_000 });

type EventBody = BodyOf<"post", "/events">;

/** Refreshes every cached calendar range after a change. */
function useRefreshCalendar() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: keyOf("/calendar") });
}

/** Adds an event, or saves an existing one (`id`). */
export function useSaveEvent() {
  const refresh = useRefreshCalendar();
  return useMutation({
    mutationFn: ({ id, event }: { id?: number | undefined; event: EventBody }) =>
      id ? api.patch(`/events/${id}`, event) : api.post("/events", event),
    onSettled: refresh,
  });
}

/** Moves an event to another day and/or time (drag and drop). */
export function useMoveEvent() {
  const refresh = useRefreshCalendar();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: BodyOf<"patch", `/events/${number}`> }) =>
      api.patch(`/events/${id}`, change),
    onSettled: refresh,
  });
}

/** Deletes a whole event, or just one day of a repeating one (`day`). */
export function useDeleteEvent() {
  const refresh = useRefreshCalendar();
  return useMutation({
    mutationFn: async ({ id, day }: { id: number; day?: string | undefined }) => {
      if (day) await api.post(`/events/${id}/skip`, { day });
      else await api.del(`/events/${id}`);
    },
    onSettled: refresh,
  });
}

/** Moves a goal's deadline. */
export function useMoveGoal() {
  const refresh = useRefreshCalendar();
  return useMutation({
    mutationFn: ({ id, targetDate }: { id: number; targetDate: string }) => api.patch(`/goals/${id}`, { targetDate }),
    onSettled: refresh,
  });
}

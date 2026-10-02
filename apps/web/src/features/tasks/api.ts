import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Tasks and their tiny steps, read and changed through the shared cache (P3-07): the Tasks page and Today
// both see the same list, a tick shows at once (and goes back if the server says no), and every change refreshes it.

type TaskList = ResponseOf<"get", "/tasks">;
type TaskChange = BodyOf<"patch", `/tasks/${number}`>;
type StepChange = BodyOf<"patch", `/steps/${number}`>;
const TASKS = keyOf("/tasks");

/** Every task, with its steps. */
export const useTasks = () => useApi("/tasks");

/** Shows a change in the cached list at once and gives back the undo (for when the server says no). */
function useOptimisticTasks() {
  const client = useQueryClient();
  return {
    show: (update: (list: TaskList) => TaskList) => optimistic<TaskList>(client, TASKS, (list) => update(list ?? [])),
    // tasks with a due day also show on the calendar
    refresh: () => Promise.all([TASKS, keyOf("/calendar")].map((queryKey) => client.invalidateQueries({ queryKey }))),
  };
}

export function useAddTask() {
  const { refresh } = useOptimisticTasks();
  return useMutation({ mutationFn: (task: BodyOf<"post", "/tasks">) => api.post("/tasks", task), onSettled: refresh });
}

/** Changes a task (done, today, priority, due day …). */
export function useUpdateTask() {
  const { show, refresh } = useOptimisticTasks();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: TaskChange }) => api.patch(`/tasks/${id}`, change),
    onMutate: ({ id, change }) =>
      show((list) => list.map((t) => (t.id === id ? ({ ...t, ...change } as typeof t) : t))),
    onError: (_error, _vars, undo) => undo?.(),
    onSettled: refresh,
  });
}

export function useDeleteTask() {
  const { show, refresh } = useOptimisticTasks();
  return useMutation({
    mutationFn: (id: number) => api.del(`/tasks/${id}`),
    onMutate: (id) => show((list) => list.filter((t) => t.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: refresh,
  });
}

/** Ticks or unticks a tiny step. */
export function useUpdateStep() {
  const { show, refresh } = useOptimisticTasks();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: StepChange }) => api.patch(`/steps/${id}`, change),
    onMutate: ({ id, change }) =>
      show((list) =>
        list.map((t) => ({ ...t, steps: t.steps.map((s) => (s.id === id ? ({ ...s, ...change } as typeof s) : s)) })),
      ),
    onError: (_error, _vars, undo) => undo?.(),
    onSettled: refresh,
  });
}

/** Removes some tiny steps (one, or all of a task's). */
export function useDeleteSteps() {
  const { show, refresh } = useOptimisticTasks();
  return useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => api.del(`/steps/${id}`))),
    onMutate: (ids) => show((list) => list.map((t) => ({ ...t, steps: t.steps.filter((s) => !ids.includes(s.id)) }))),
    onError: (_error, _ids, undo) => undo?.(),
    onSettled: refresh,
  });
}

/** Asks the AI to break a task into tiny steps and saves them on it. */
export function useBreakDown() {
  const { refresh } = useOptimisticTasks();
  return useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const { steps } = await api.post("/ai/steps", { task: title });
      return api.post(`/tasks/${id}/steps`, { steps });
    },
    onSettled: refresh,
  });
}

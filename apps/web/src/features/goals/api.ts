import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Goals, their plan steps and progress logs through the shared cache (P3-09). Most changes answer with the whole
// goal, which is put straight into the cached list; ticking or deleting a step or a log shows at once.

type GoalList = ResponseOf<"get", "/goals">;
type Goal = GoalList[number];
const GOALS = keyOf("/goals");

export const useGoals = () => useApi("/goals");

function useGoalCache() {
  const client = useQueryClient();
  return {
    /** Puts the goal the server sent back into the list (a new one goes first). */
    write: (g: Goal) => client.setQueryData<GoalList>(GOALS, (list = []) => (list.some((x) => x.id === g.id) ? list.map((x) => (x.id === g.id ? g : x)) : [g, ...list])),
    /** Shows a change to one goal at once; returns the undo. */
    show: (id: number, update: (g: Goal) => Goal) => optimistic<GoalList>(client, GOALS, (list = []) => list.map((g) => (g.id === id ? update(g) : g))),
    refresh: () => client.invalidateQueries({ queryKey: GOALS }),
  };
}

export function useAddGoal() {
  const { write, refresh } = useGoalCache();
  return useMutation({ mutationFn: (goal: BodyOf<"post", "/goals">) => api.post("/goals", goal), onSuccess: write, onSettled: refresh });
}

export function useDeleteGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/goals/${id}`),
    onMutate: (id) => optimistic<GoalList>(client, GOALS, (list = []) => list.filter((g) => g.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: GOALS }),
  });
}

/** Everything that changes one goal: its fields, the AI check, plan steps and progress logs. */
export function useGoalChanges(id: number) {
  const { write, show, refresh } = useGoalCache();
  const answer = { onSuccess: write, onSettled: refresh };
  return {
    update: useMutation({ mutationFn: (change: BodyOf<"patch", `/goals/${number}`>) => api.patch(`/goals/${id}`, change), ...answer }),
    analyze: useMutation({ mutationFn: () => api.post(`/goals/${id}/analyze`), onSuccess: (out) => write(out.goal), onSettled: refresh }),
    addActions: useMutation({ mutationFn: (texts: string[]) => api.post(`/goals/${id}/actions`, { texts }), ...answer }),
    addLog: useMutation({ mutationFn: (text: string) => api.post(`/goals/${id}/logs`, { text }), ...answer }),
    toggleAction: useMutation({
      mutationFn: (a: { id: number; done: boolean }) => api.patch(`/goal-actions/${a.id}`, { done: !a.done }),
      onMutate: (a) => show(id, (g) => ({ ...g, actions: g.actions.map((x) => (x.id === a.id ? { ...x, done: !a.done } : x)) })),
      onError: (_error, _a, undo) => undo?.(),
      onSettled: refresh,
    }),
    deleteAction: useMutation({
      mutationFn: (actionId: number) => api.del(`/goal-actions/${actionId}`),
      onMutate: (actionId) => show(id, (g) => ({ ...g, actions: g.actions.filter((x) => x.id !== actionId) })),
      onError: (_error, _id, undo) => undo?.(),
      onSettled: refresh,
    }),
    deleteLog: useMutation({
      mutationFn: (logId: number) => api.del(`/goal-logs/${logId}`),
      onMutate: (logId) => show(id, (g) => ({ ...g, logs: g.logs.filter((x) => x.id !== logId) })),
      onError: (_error, _id, undo) => undo?.(),
      onSettled: refresh,
    }),
  };
}

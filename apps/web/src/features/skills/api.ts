import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// The skills gap map through the shared cache (P3-09). Rating a skill (the dots) shows at once and goes back if the
// server says no; adding many skills answers with the whole list, which replaces the cached one.

type SkillList = ResponseOf<"get", "/skills">;
const SKILLS = keyOf("/skills");

export const useSkills = () => useApi("/skills");

function useSkillCache() {
  const client = useQueryClient();
  return {
    client,
    show: (update: (list: SkillList) => SkillList) => optimistic<SkillList>(client, SKILLS, (list) => update(list ?? [])),
    refresh: () => client.invalidateQueries({ queryKey: SKILLS }),
  };
}

export function useAddSkill() {
  const { client, refresh } = useSkillCache();
  return useMutation({
    mutationFn: (skill: BodyOf<"post", "/skills">) => api.post("/skills", skill),
    onSuccess: (s) => client.setQueryData<SkillList>(SKILLS, (list = []) => [...list, s]),
    onSettled: refresh,
  });
}

/** Adds several skills at once (the starter list, or the AI's ideas). */
export function useAddSkills() {
  const { client, refresh } = useSkillCache();
  return useMutation({
    mutationFn: (items: NonNullable<BodyOf<"post", "/skills/bulk">["items"]>) => api.post("/skills/bulk", { items }),
    onSuccess: (list) => client.setQueryData<SkillList>(SKILLS, list),
    onSettled: refresh,
  });
}

/** Changes a skill (level, target, notes). */
export function useUpdateSkill() {
  const { show, refresh } = useSkillCache();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: BodyOf<"patch", `/skills/${number}`> }) => api.patch(`/skills/${id}`, change),
    onMutate: ({ id, change }) => show((list) => list.map((s) => (s.id === id ? { ...s, ...change } as typeof s : s))),
    onError: (_error, _vars, undo) => undo?.(),
    onSettled: refresh,
  });
}

export function useDeleteSkill() {
  const { show, refresh } = useSkillCache();
  return useMutation({
    mutationFn: (id: number) => api.del(`/skills/${id}`),
    onMutate: (id) => show((list) => list.filter((s) => s.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: refresh,
  });
}

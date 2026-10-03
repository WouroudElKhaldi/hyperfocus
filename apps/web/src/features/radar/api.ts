import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Job Radar on the website (P6-27, P6-28): your filters, your matches, the majors, the radar's state.

export type Match = ResponseOf<"get", "/radar/matches">["items"][number];
export type Filter = ResponseOf<"get", "/job-filters">[number];
export type Spec = Filter["spec"];
export type SpecInput = NonNullable<BodyOf<"post", "/job-filters">["spec"]>;

export const useFilters = () => useApi("/job-filters");
export const useMatches = (limit = 20) => useApi(`/radar/matches?limit=${limit}` as "/radar/matches", { meta: { silent: true } });
export const useSaved = () => useApi("/radar/matches?status=saved&limit=50" as "/radar/matches", { meta: { silent: true } });
export const useMajors = () => useApi("/presets/majors");
export const useRadarStatus = () => useApi("/radar/status", { meta: { silent: true } });

/** After any change: the lists read again. */
function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ predicate: (q) => /\/(radar|job-filters)/.test(JSON.stringify(q.queryKey)) });
}

export function useRadarActions() {
  const refresh = useRefresh();
  return {
    fromPreset: useMutation({ mutationFn: (fieldCode: string) => api.post("/job-filters/from-preset", { fieldCode }), onSuccess: refresh }),
    create: useMutation({ mutationFn: (b: { name: string; spec: SpecInput }) => api.post("/job-filters", b), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, ...change }: { id: number; name?: string; enabled?: boolean; spec?: SpecInput }) => api.patch(`/job-filters/${id}`, change), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: number) => api.del(`/job-filters/${id}`), onSuccess: refresh }),
    mark: useMutation({
      mutationFn: ({ id, ...change }: { id: number; status?: "new" | "seen" | "saved" | "dismissed"; feedback?: -1 | 0 | 1 }) => api.patch(`/radar/matches/${id}`, change),
      onSuccess: refresh,
    }),
    apply: useMutation({ mutationFn: (id: number) => api.post(`/radar/matches/${id}/apply`), onSuccess: refresh }),
    // P6-30: a task with steps, and the skills it asks for onto your Skills map
    prepare: useMutation({ mutationFn: (id: number) => api.post(`/radar/matches/${id}/prepare`), onSuccess: refresh }),
    gaps: useMutation({ mutationFn: (id: number) => api.post(`/radar/matches/${id}/skill-gaps`) }),
  };
}

/** P6-28: ≈ jobs a week for a filter being built (asked after a short pause). */
export const previewFilter = (spec: SpecInput) => api.post("/job-filters/preview", { spec });

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Job applications through the shared cache (P3-13). The email editor's "linked job" list reads the same data, and
// linking an email here refreshes both the job and the emails.

type JobList = ResponseOf<"get", "/jobs">;
const JOBS = keyOf("/jobs");

export const useJobs = () => useApi("/jobs");
/** One job with its emails. Its page shows a failed load itself. */
export const useJob = (id: string) => useApi(`/jobs/${id}`, { enabled: /^\d+$/.test(id), meta: { silent: true } });

function useRefreshJobs() {
  const client = useQueryClient();
  return () => Promise.all([JOBS, keyOf("/emails")].map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function useAddJob() {
  const refresh = useRefreshJobs();
  return useMutation({ mutationFn: (job: BodyOf<"post", "/jobs">) => api.post("/jobs", job), onSettled: refresh });
}

/** Changes a job (status, details). A status change shows on the list at once. */
export function useUpdateJob() {
  const client = useQueryClient();
  const refresh = useRefreshJobs();
  return useMutation({
    mutationFn: ({ id, change }: { id: number; change: BodyOf<"patch", `/jobs/${number}`> }) => api.patch(`/jobs/${id}`, change),
    onMutate: ({ id, change }) => optimistic<JobList>(client, JOBS, (list = []) => list.map((j) => (j.id === id ? { ...j, ...change } as typeof j : j))),
    onError: (_error, _vars, undo) => undo?.(),
    onSettled: refresh,
  });
}

export function useDeleteJob() {
  const client = useQueryClient();
  const refresh = useRefreshJobs();
  return useMutation({
    mutationFn: (id: number) => api.del(`/jobs/${id}`),
    onMutate: (id) => optimistic<JobList>(client, JOBS, (list = []) => list.filter((j) => j.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: refresh,
  });
}

/** Links an email to a job, or unlinks it (`jobId: null`). */
export function useLinkEmail() {
  const refresh = useRefreshJobs();
  return useMutation({
    mutationFn: ({ emailId, jobId }: { emailId: number | string; jobId: number | null }) => api.put(`/emails/${emailId}/job`, { jobId }),
    onSettled: refresh,
  });
}

/** Starts an email for a job (already linked). Answers with the new email, to open it. */
export function useWriteJobEmail() {
  const refresh = useRefreshJobs();
  return useMutation({ mutationFn: (id: number) => api.post(`/jobs/${id}/email`), onSettled: refresh });
}

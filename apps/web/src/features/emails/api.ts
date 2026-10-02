import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Emails and templates through the shared cache (P3-12). The editor's fields and text stay its own (they autosave),
// so a refresh never overwrites typing; the email's status (sent, failed, linked job) comes from the cache.

type EmailList = ResponseOf<"get", "/emails">;
type Email = ResponseOf<"get", `/emails/${number}`>;
type TemplateList = ResponseOf<"get", "/email-templates">;
const EMAILS = keyOf("/emails");
const TEMPLATES = keyOf("/email-templates");

export const useEmails = () => useApi("/emails");
export const useTemplates = () => useApi("/email-templates");
/** One email. Its page shows a failed load itself. */
export const useEmail = (id: string) => useApi(`/emails/${id}`, { enabled: /^\d+$/.test(id), meta: { silent: true } });
/** Whether Gmail is set up (the editor explains what's missing). */
export const useMailStatus = () => useApi("/emails/status", { meta: { silent: true } });

function useRefresh(...keys: ReturnType<typeof keyOf>[]) {
  const client = useQueryClient();
  return () => Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

/** A new blank email, or one started from a template (`templateId`). Answers with the new email (to open it). */
export function useNewEmail() {
  const refresh = useRefresh(EMAILS);
  return useMutation({
    mutationFn: (templateId?: number) => (templateId ? api.post(`/email-templates/${templateId}/use`) : api.post("/emails")),
    onSettled: refresh,
  });
}

export function useDeleteEmail() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/emails/${id}`),
    onMutate: (id) => optimistic<EmailList>(client, EMAILS, (list = []) => list.filter((m) => m.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: EMAILS }),
  });
}

export function useRenameTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.patch(`/email-templates/${id}`, { name }),
    onMutate: ({ id, name }) => optimistic<TemplateList>(client, TEMPLATES, (list = []) => list.map((t) => (t.id === id ? { ...t, name } : t))),
    onError: (_error, _vars, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: TEMPLATES }),
  });
}

export function useDeleteTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/email-templates/${id}`),
    onMutate: (id) => optimistic<TemplateList>(client, TEMPLATES, (list = []) => list.filter((t) => t.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: TEMPLATES }),
  });
}

/** What the editor does to one email besides autosaving: send, link a job, save as a template, duplicate. */
export function useEmailChanges(id: string) {
  const client = useQueryClient();
  const key = keyOf(`/emails/${id}`);
  const patchCached = (change: Partial<Email>) => client.setQueryData<Email>(key, (m) => (m ? { ...m, ...change } : m));
  const refresh = useRefresh(key, EMAILS);
  return {
    // a refused send still changes the email (it becomes "Not sent" with the reason), so it reloads either way
    send: useMutation({
      mutationFn: (draft: BodyOf<"post", `/emails/${number}/send`>) => api.post(`/emails/${id}/send`, draft),
      onSuccess: (out) => patchCached({ ...out.email }),
      onSettled: refresh,
      meta: { silent: true },
    }),
    linkJob: useMutation({
      mutationFn: (jobId: string) => api.put(`/emails/${id}/job`, { jobId }),
      onSuccess: (out) => patchCached({ jobId: out.jobId }),
      onSettled: useRefresh(key, keyOf("/jobs")),
    }),
    saveTemplate: useMutation({
      mutationFn: (template: BodyOf<"post", `/emails/${number}/save-template`>) => api.post(`/emails/${id}/save-template`, template),
      onSettled: useRefresh(TEMPLATES),
    }),
    duplicate: useMutation({ mutationFn: () => api.post(`/emails/${id}/duplicate`), onSettled: refresh }),
  };
}

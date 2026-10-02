import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// The companion chat (P3-14). The saved chats list is cached; the conversation on screen stays the page's own
// (a temporary chat is never saved anywhere).

type Threads = ResponseOf<"get", "/chat/threads">;
const THREADS = keyOf("/chat/threads");

export const useThreads = () => useApi("/chat/threads");

function useRefreshThreads() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: THREADS });
}

/** Sends a message. The reply comes back with the saved thread (unless it is a temporary chat). */
export function useSendChat() {
  const refresh = useRefreshThreads();
  return useMutation({ mutationFn: (body: BodyOf<"post", "/chat">) => api.post("/chat", body), onSettled: refresh });
}

/** Opens a saved chat (its messages). */
export function useOpenThread() {
  const refresh = useRefreshThreads();
  return useMutation({ mutationFn: (id: number) => api.get(`/chat/threads/${id}`), onError: refresh });
}

export function useRenameThread() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => api.patch(`/chat/threads/${id}`, { title }),
    onMutate: ({ id, title }) => optimistic<Threads>(client, THREADS, (list = []) => list.map((t) => (t.id === id ? { ...t, title } : t))),
    onError: (_error, _vars, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: THREADS }),
  });
}

/** Deletes one saved chat, or all of them (`id` left out). */
export function useDeleteThreads() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id?: number) => (id === undefined ? api.del("/chat/threads") : api.del(`/chat/threads/${id}`)),
    onMutate: (id) => optimistic<Threads>(client, THREADS, (list = []) => (id === undefined ? [] : list.filter((t) => t.id !== id))),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: THREADS }),
  });
}

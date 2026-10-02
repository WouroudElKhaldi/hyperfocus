import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { ResponseOf } from "../../api/typed.ts";

// LinkedIn posts through the shared cache (P3-11). What the server answers after a change (schedule, publish …) is
// written into both the post and the list. The editor's text stays its own, so a refresh never overwrites your typing.

type PostList = ResponseOf<"get", "/posts">;
type Post = ResponseOf<"get", `/posts/${number}`>;
const POSTS = keyOf("/posts");

export const usePosts = () => useApi("/posts");

/** One post. `live` looks again every 15 s (while it is scheduled or being sent). The page shows a failed load itself. */
export const usePost = (id: string, live = false) =>
  useApi(`/posts/${id}`, { enabled: /^\d+$/.test(id), meta: { silent: true }, ...(live ? { refetchInterval: 15_000 } : {}) });

function useWritePost() {
  const client = useQueryClient();
  return (p: Post) => {
    client.setQueryData<Post>(keyOf(`/posts/${p.id}`), p);
    client.setQueryData<PostList>(POSTS, (list) => list?.map((x) => (x.id === p.id ? p : x)));
  };
}

export function useCreatePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (thought: string) => api.post("/posts", { thought }),
    onSettled: () => client.invalidateQueries({ queryKey: POSTS }),
  });
}

export function useDeletePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/posts/${id}`),
    onMutate: (id) => optimistic<PostList>(client, POSTS, (list = []) => list.filter((p) => p.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: POSTS }),
  });
}

/** Changes to one post's status. Each first saves the text you see, so what gets posted is what you wrote. */
export function usePostStatus(id: number, text: () => { thought: string; draft: string }) {
  const write = useWritePost();
  const saveFirst = <T,>(then: () => Promise<T>) => async () => {
    await api.patch(`/posts/${id}`, text());
    return then();
  };
  return {
    schedule: useMutation({
      mutationFn: (scheduledAt: string) => saveFirst(() => api.post(`/posts/${id}/schedule`, { scheduledAt }))(),
      onSuccess: write,
    }),
    unschedule: useMutation({ mutationFn: () => api.post(`/posts/${id}/unschedule`), onSuccess: write }),
    publish: useMutation({ mutationFn: saveFirst(() => api.post(`/posts/${id}/publish`)), onSuccess: write, meta: { silent: true } }),
    markPosted: useMutation({ mutationFn: () => api.post(`/posts/${id}/mark-posted`), onSuccess: write }),
  };
}

import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import type { ApiMeta } from "./query.ts";
import { keyOf } from "./query.ts";
import type { ApiUrl, BodyOf, Method, ResponseOf } from "./typed.ts";

// Hooks for the pages (P3-03): read with useApi, change with useApiChange. Typed like api.ts: the address is checked
// against the real routes and the data has the route's type.

/** Reads an address and keeps it fresh: `const tasks = useApi("/tasks")` → tasks.data, tasks.isPending, tasks.error. */
export function useApi<const U extends string>(
  url: U & ApiUrl<"get", U>,
  options: { enabled?: boolean; meta?: ApiMeta; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: keyOf(url),
    // (the address was checked where the hook is called; here it only needs passing on)
    queryFn: () => (api.get as (u: string) => Promise<ResponseOf<"get", U>>)(url),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.meta ? { meta: options.meta } : {}),
    // (for what changes on its own, like the clock moving on or a reminder being sent)
    ...(options.refetchInterval ? { refetchInterval: options.refetchInterval } : {}),
  });
}

type ChangeMethod = Exclude<Method, "get">;
const send = { post: api.post, put: api.put, patch: api.patch, delete: api.del } as const;

/**
 * Changes something: `const add = useApiChange("post", "/tasks", { refresh: ["/tasks"] })` → add.mutate({ title }).
 * `refresh` lists the addresses whose data changes (everything under each is refreshed after success);
 * `onMutate`/`onError` can make it optimistic (see optimistic() in query.ts).
 */
export function useApiChange<M extends ChangeMethod, const U extends string, Ctx = unknown>(
  method: M,
  url: U & ApiUrl<M, U>,
  options: {
    refresh?: string[];
    meta?: ApiMeta;
    onMutate?: (body: BodyOf<M, U>) => Promise<Ctx> | Ctx;
    onError?: (error: unknown, body: BodyOf<M, U>, context: Ctx | undefined) => void;
    onSuccess?: (data: ResponseOf<M, U>, body: BodyOf<M, U>) => void;
  } = {},
) {
  const client = useQueryClient();
  return useMutation<ResponseOf<M, U>, unknown, BodyOf<M, U>, Ctx>({
    mutationFn: (body) => (send[method] as (u: string, b?: unknown) => Promise<ResponseOf<M, U>>)(url, body),
    ...(options.meta ? { meta: options.meta } : {}),
    ...(options.onMutate ? { onMutate: options.onMutate } : {}),
    onError: (error, body, context) => options.onError?.(error, body, context),
    onSuccess: (data, body) => options.onSuccess?.(data, body),
    onSettled: () =>
      Promise.all((options.refresh ?? []).map((u) => client.invalidateQueries({ queryKey: keyOf(u) as QueryKey }))),
  });
}

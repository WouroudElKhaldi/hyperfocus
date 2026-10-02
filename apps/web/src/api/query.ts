import { MutationCache, QueryCache, QueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorOf } from "../api.ts";

// TanStack Query for the website (P3-03): one cache for everything read from the API, so pages share data, show it at
// once when you come back, and refresh what a change affects. Pages move onto it in P3-07 … P3-16.

/** The cache key of an address: ["api", ...its path segments, its query]. A prefix (keyOf("/tasks")) covers everything under it. */
export function keyOf(url: string): QueryKey {
  const [path = "", query] = url.split("?");
  const parts = path.split("/").filter(Boolean);
  return query ? ["api", ...parts, Object.fromEntries(new URLSearchParams(query))] : ["api", ...parts];
}

/** Never retry a request the server refused (4xx: retrying can't help); retry anything else once. */
export const shouldRetry = (failures: number, error: unknown) => {
  const status = errorOf(error).status;
  return !(status && status >= 400 && status < 500) && failures < 1;
};

/** Options for a query or a change: `silent` means no error toast (the page shows the problem itself). */
export type ApiMeta = { silent?: boolean };
const showError = (error: unknown, meta: Record<string, unknown> | undefined) => {
  if (!(meta as ApiMeta | undefined)?.silent) toast.error(errorOf(error).message);
};

export function createQueryClient() {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => showError(error, query.meta) }),
    mutationCache: new MutationCache({ onError: (error, _v, _c, mutation) => showError(error, mutation.meta) }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
  return client;
}

/**
 * The pages not on Query yet announce their changes with the "data-changed" event (see api.ts); everything on screen
 * that came from the API is then refreshed, so both kinds of pages always agree. Returns the function that stops it.
 */
export function refreshOnDataChanged(client: QueryClient) {
  const refresh = () => void client.invalidateQueries({ queryKey: ["api"] });
  window.addEventListener("data-changed", refresh);
  return () => window.removeEventListener("data-changed", refresh);
}

/**
 * An optimistic change: shows `update` in the cache at once and returns how to undo it, for when the server says no.
 * Use it in a mutation's onMutate, and call the returned function in onError.
 */
export async function optimistic<T>(client: QueryClient, key: QueryKey, update: (current: T | undefined) => T) {
  await client.cancelQueries({ queryKey: key }); // an older answer arriving now would overwrite the change
  const before = client.getQueryData<T>(key);
  client.setQueryData<T>(key, update(before));
  return () => client.setQueryData<T>(key, before);
}

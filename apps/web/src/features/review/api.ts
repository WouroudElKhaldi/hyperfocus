import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { ResponseOf } from "../../api/typed.ts";

// Weekly reviews through the shared cache (P3-09). Writing a new one is a useApiChange on the page.

type ReviewList = ResponseOf<"get", "/reviews">;
const REVIEWS = keyOf("/reviews");

/** Every review, newest first. */
export const useReviews = () => useApi("/reviews");

export function useDeleteReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/reviews/${id}`),
    onMutate: (id) => optimistic<ReviewList>(client, REVIEWS, (list = []) => list.filter((r) => r.id !== id)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: REVIEWS }),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { ResponseOf } from "../../api/typed.ts";

// Wins through the shared cache (P3-14). The list mixes wins you log with finished tasks, posts and study sessions.

type WinList = ResponseOf<"get", "/wins">;
const WINS = keyOf("/wins");

export const useWins = () => useApi("/wins");

export function useAddWin() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (text: string) => api.post("/wins", { text }), onSettled: () => client.invalidateQueries({ queryKey: WINS }) });
}

/** Deletes a win you logged (shown gone at once). */
export function useDeleteWin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (winId: number) => api.del(`/wins/${winId}`),
    onMutate: (winId) => optimistic<WinList>(client, WINS, (list = []) => list.filter((w) => w.winId !== winId)),
    onError: (_error, _id, undo) => undo?.(),
    onSettled: () => client.invalidateQueries({ queryKey: WINS }),
  });
}

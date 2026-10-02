import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf } from "../../api/query.ts";
import type { BodyOf } from "../../api/typed.ts";

// The companion pet through the shared cache (P3-15). One copy for the whole app (sidebar card, top bar, celebration,
// the Pet page). It looks again every 30 s and after every change anywhere, since finishing things earns it points.

const PET = keyOf("/pet");

/** The pet's state ({ pet: null } before one is chosen), or undefined while loading. Shown quietly: no error toasts. */
export const usePetQuery = () => useApi("/pet", { refetchInterval: 30_000, meta: { silent: true } });

/** What can be picked when making a pet (only needed before there is one). */
export const usePetCatalog = (enabled: boolean) => useApi("/pet/catalog", { enabled });

/** Makes the pet (an egg), or changes it (details, wardrobe). The answer is the new state. */
export function usePetChanges() {
  const client = useQueryClient();
  const write = (s: unknown) => client.setQueryData(PET, s);
  return {
    create: useMutation({ mutationFn: (pet: BodyOf<"post", "/pet">) => api.post("/pet", pet), onSuccess: write }),
    update: useMutation({ mutationFn: (change: BodyOf<"patch", "/pet">) => api.patch("/pet", change), onSuccess: write }),
  };
}

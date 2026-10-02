import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api.ts";
import { useApi } from "../../api/hooks.ts";
import { keyOf, optimistic } from "../../api/query.ts";
import type { BodyOf, ResponseOf } from "../../api/typed.ts";

// Settings and backups through the shared cache (P3-14).

type Settings = ResponseOf<"get", "/settings">;
const SETTINGS = keyOf("/settings");

export const useSettings = () => useApi("/settings", { meta: { silent: true } });
export const useBackups = () => useApi("/backups");

/** Changes a setting: shown at once, and back to how it was if the server says no. */
export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: BodyOf<"patch", "/settings">) => api.patch("/settings", change),
    onMutate: (change) => optimistic<Settings | undefined>(client, SETTINGS, (s) => (s ? ({ ...s, ...change } as Settings) : s)),
    onError: (_error, _change, undo) => undo?.(),
    onSuccess: (s) => client.setQueryData(SETTINGS, s),
  });
}

/** Makes a backup now; the answer is the new list of backups. */
export function useBackupNow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/backups"),
    onSuccess: (out) => client.setQueryData(keyOf("/backups"), { backups: out.backups, folder: out.folder }),
  });
}

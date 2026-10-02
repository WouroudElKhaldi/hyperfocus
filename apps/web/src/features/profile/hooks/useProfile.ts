import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { keyOf } from "../../../api/query.ts";
import type { BodyOf } from "../../../api/typed.ts";

// The saved profile, shared by the top bar, the greeting and the Profile page (P3-14: one cached copy, so saving it on
// the Profile page updates the top bar and the greeting at once).

/** The profile, or null until it has loaded (a failed load just keeps the defaults; it is tried again later). */
export const useProfile = () => useApi("/profile", { meta: { silent: true } }).data ?? null;

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (profile: BodyOf<"put", "/profile">) => api.put("/profile", profile),
    onSuccess: (p) => client.setQueryData(keyOf("/profile"), p),
  });
}

export const initialsOf = (name: string | undefined) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0] ?? "", last = parts.length > 1 ? (parts.at(-1) ?? "") : "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
};

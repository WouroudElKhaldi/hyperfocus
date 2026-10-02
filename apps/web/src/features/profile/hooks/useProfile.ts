import { useEffect, useState } from "react";
import { api } from "../../../api.ts";
import type { Profile } from "../../../types.ts";

// The saved profile, shared by the top bar, the greeting and the Profile page.
let cache: Profile | null = null;
const subs = new Set<(p: Profile) => void>();
async function load() {
  try { const p = await api.get("/profile"); cache = p; subs.forEach((f) => f(p)); } catch { /* try again on the next visit */ }
}
export function setProfileCache(p: Profile) { cache = p; subs.forEach((f) => f(p)); }

export function useProfile(): Profile | null {
  const [p, setP] = useState<Profile | null>(cache);
  useEffect(() => {
    subs.add(setP);
    if (!cache) load(); else setP(cache);
    return () => { subs.delete(setP); };
  }, []);
  return p;
}

export const initialsOf = (name: string | undefined) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0] ?? "", last = parts.length > 1 ? (parts.at(-1) ?? "") : "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
};

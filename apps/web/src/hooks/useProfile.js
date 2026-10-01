import { useEffect, useState } from "react";
import { api } from "../api.js";

// The saved profile, shared by the top bar, the greeting and the Profile page.
let cache = null;
const subs = new Set();
async function load() {
  try { cache = await api.get("/profile"); subs.forEach((f) => f(cache)); } catch { /* try again on the next visit */ }
}
export function setProfileCache(p) { cache = p; subs.forEach((f) => f(p)); }

export function useProfile() {
  const [p, setP] = useState(cache);
  useEffect(() => {
    subs.add(setP);
    if (!cache) load(); else setP(cache);
    return () => subs.delete(setP);
  }, []);
  return p;
}

export const initialsOf = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

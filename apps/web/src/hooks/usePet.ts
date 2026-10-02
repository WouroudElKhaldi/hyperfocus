import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { PetResponse } from "../types.ts";

// One shared copy of the pet's state for the whole app (top bar, sidebar, celebration), refreshed from a single place.
let state: PetResponse | null = null;
const subs = new Set<(s: PetResponse) => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;
let inflight = false;
let again = false;

async function refresh() {
  if (inflight) { again = true; return; } // something changed while loading: load once more afterwards
  inflight = true;
  try {
    const next = await api.get("/pet");
    state = next;
    subs.forEach((f) => f(next));
  } catch { /* the server may be restarting, the next refresh will catch up */ }
  inflight = false;
  if (again) { again = false; refresh(); }
}
const onChange = () => { clearTimeout(debounce); debounce = setTimeout(refresh, 600); };
function start() {
  if (timer) return;
  refresh();
  timer = setInterval(refresh, 30000);
  window.addEventListener("focus", refresh);
  window.addEventListener("data-changed", onChange);
}
function stop() {
  clearInterval(timer); timer = undefined; clearTimeout(debounce);
  window.removeEventListener("focus", refresh);
  window.removeEventListener("data-changed", onChange);
}

/** The pet's state, shared by every component that shows it. null until the first load. */
export function usePet(): PetResponse | null {
  const [s, setS] = useState<PetResponse | null>(state);
  useEffect(() => {
    subs.add(setS);
    start();
    if (state) setS(state);
    return () => { subs.delete(setS); if (!subs.size) stop(); };
  }, []);
  return s;
}

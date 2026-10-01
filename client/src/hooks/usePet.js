import { useEffect, useState } from "react";
import { api } from "../api.js";

// One shared copy of the pet's state for the whole app (top bar, sidebar, celebration), refreshed from a single place.
let state = null;
const subs = new Set();
let timer = null;
let debounce = null;
let inflight = false;
let again = false;

async function refresh() {
  if (inflight) { again = true; return; } // something changed while loading: load once more afterwards
  inflight = true;
  try {
    state = await api.get("/pet");
    subs.forEach((f) => f(state));
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
  clearInterval(timer); timer = null; clearTimeout(debounce);
  window.removeEventListener("focus", refresh);
  window.removeEventListener("data-changed", onChange);
}

export function usePet() {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    start();
    if (state) setS(state);
    return () => { subs.delete(setS); if (!subs.size) stop(); };
  }, []);
  return s;
}

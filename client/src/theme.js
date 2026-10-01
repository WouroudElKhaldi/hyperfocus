// Two separate choices:
//  - mode: light / dark / follow-the-system ("auto" removes the attribute so the operating system decides)
//  - palette: the main color of the whole site (see palettes.js), picked on the Profile page
import { DEFAULT_PALETTE, TOKEN_NAMES, getPaletteDef, paletteTokens } from "./palettes.js";

const KEY = "theme";
const PKEY = "palette";
export const getTheme = () => { try { return localStorage.getItem(KEY) || "auto"; } catch { return "auto"; } };
export function applyTheme(t) {
  const root = document.documentElement;
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
  applyPalette(getPalette()); // the palette has separate colors for light and dark
}
// what you actually see right now, even when the setting is "auto"
export function effectiveTheme() {
  const t = getTheme();
  if (t === "light" || t === "dark") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch { /* storage may be unavailable */ }
  applyTheme(t);
  window.dispatchEvent(new Event("theme-change")); // lets the top bar switch and the Settings page stay in sync
}

export const getPalette = () => { try { return getPaletteDef(localStorage.getItem(PKEY) || DEFAULT_PALETTE).id; } catch { return DEFAULT_PALETTE; } };
export function applyPalette(id) {
  const root = document.documentElement.style;
  for (const k of TOKEN_NAMES) root.removeProperty(k);
  if (id === DEFAULT_PALETTE) return; // the original colors come straight from the stylesheet
  const tokens = paletteTokens(getPaletteDef(id), effectiveTheme());
  for (const [k, v] of Object.entries(tokens)) root.setProperty(k, v);
}
export function setPalette(id) {
  const p = getPaletteDef(id);
  try { localStorage.setItem(PKEY, p.id); } catch { /* storage may be unavailable */ }
  applyPalette(p.id);
  window.dispatchEvent(new Event("palette-change"));
}
// when the operating system flips between light and dark while the mode is "auto", the palette follows
try { window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => applyPalette(getPalette())); } catch { /* old browsers */ }

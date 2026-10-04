// Two separate choices:
//  - mode: light / dark / follow-the-system ("auto" removes the attribute so the operating system decides)
//  - palette: the main color of the whole site (see palettes.js), picked on the Profile page
import { DEFAULT_PALETTE, TOKEN_NAMES, getPaletteDef, monoTokens, paletteTokens } from "./palettes.ts";

const KEY = "theme";
const PKEY = "palette";
export const getTheme = () => { try { return localStorage.getItem(KEY) || "auto"; } catch { return "auto"; } };
/** "light", "dark", "auto" (follow the system), or the two looks without color: "white" (all white) and "black" (all black, P3-26). */
export type ThemeMode = "light" | "dark" | "auto" | "white" | "black";
/** the light or dark base of a mode (all white is light, all black is dark) */
const baseOf = (t: string): "light" | "dark" | null => (t === "light" || t === "white" ? "light" : t === "dark" || t === "black" ? "dark" : null);
export const isMono = (t = getTheme()) => t === "white" || t === "black";
export function applyTheme(t: string) {
  const root = document.documentElement;
  const base = baseOf(t);
  if (base) root.setAttribute("data-theme", base); else root.removeAttribute("data-theme");
  if (isMono(t)) root.setAttribute("data-look", t); else root.removeAttribute("data-look");
  applyPalette(getPalette()); // the palette has separate colors for light and dark
}
// what you actually see right now, even when the setting is "auto"
export function effectiveTheme(): "light" | "dark" {
  return baseOf(getTheme()) ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
export function setTheme(t: ThemeMode) {
  try { localStorage.setItem(KEY, t); } catch { /* storage may be unavailable */ }
  applyTheme(t);
  window.dispatchEvent(new Event("theme-change")); // lets the top bar switch and the Settings page stay in sync
}

export const getPalette = () => { try { return getPaletteDef(localStorage.getItem(PKEY) || DEFAULT_PALETTE).id; } catch { return DEFAULT_PALETTE; } };
export function applyPalette(id: string) {
  const root = document.documentElement.style;
  for (const k of TOKEN_NAMES) root.removeProperty(k);
  // all white / all black: no color, whatever the palette
  if (isMono()) {
    for (const [k, v] of Object.entries(monoTokens(effectiveTheme()))) root.setProperty(k, v);
    return;
  }
  if (id === DEFAULT_PALETTE) return; // the original colors come straight from the stylesheet
  const tokens = paletteTokens(getPaletteDef(id), effectiveTheme());
  for (const [k, v] of Object.entries(tokens)) root.setProperty(k, v);
}
export function setPalette(id: string) {
  const p = getPaletteDef(id);
  try { localStorage.setItem(PKEY, p.id); } catch { /* storage may be unavailable */ }
  applyPalette(p.id);
  window.dispatchEvent(new Event("palette-change"));
}
// when the operating system flips between light and dark while the mode is "auto", the palette follows
try { window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => applyPalette(getPalette())); } catch { /* old browsers */ }

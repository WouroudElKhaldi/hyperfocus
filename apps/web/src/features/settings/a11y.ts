import type { FontChoice, MotionChoice, TextSize } from "@hyperfocus/shared/constants";
import { useEffect } from "react";
import { useSettings } from "./api.ts";

// The accessibility settings (P3-18) take effect as attributes on <html> (data-motion, data-font, data-text, data-focus);
// tailwind.css says what each one changes. They are saved on the server with the other settings, so they follow you;
// a copy in this browser only puts them on screen before the page has loaded them (no flash of the wrong size).

export type A11y = { motion: MotionChoice; font: FontChoice; textSize: TextSize; focusMode: boolean };
const KEY = "a11y";

export function applyA11y(a: A11y) {
  const el = document.documentElement;
  el.dataset["motion"] = a.motion;
  el.dataset["font"] = a.font;
  el.dataset["text"] = a.textSize;
  el.dataset["focus"] = a.focusMode ? "on" : "off";
  // the easy-read font is only downloaded by people who choose it
  if (a.font === "readable") void Promise.all([import("@fontsource/atkinson-hyperlegible/400.css"), import("@fontsource/atkinson-hyperlegible/700.css")]);
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage can be unavailable */ }
}

/** Before the first paint: what this browser saw last time. */
export function applySavedA11y() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as A11y | null;
    if (saved) applyA11y(saved);
  } catch { /* nothing saved, or storage unavailable: the defaults apply */ }
}

/** Keeps the page in step with the saved settings (and with every change to them). Used once, by the app shell. */
export function useA11y() {
  const s = useSettings().data;
  useEffect(() => {
    if (s) applyA11y({ motion: s.motion, font: s.font, textSize: s.textSize, focusMode: s.focusMode });
  }, [s?.motion, s?.font, s?.textSize, s?.focusMode]);
  return s;
}

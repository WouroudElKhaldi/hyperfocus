// The settings feature's public parts (P3-18): the accessibility settings, applied by the app shell.
export { applySavedA11y, useA11y } from "./a11y.ts";
export { useSaveSettings } from "./api.ts";
export { default as Privacy } from "./pages/Privacy.tsx"; // P5-12: also shown signed out

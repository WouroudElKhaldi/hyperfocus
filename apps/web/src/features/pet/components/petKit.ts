// Small helpers shared by the pet drawing files.
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const rgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// mix a hex color toward another by t (0..1)
export function mix(hex: string, toHex: string, t: number): string {
  const a = rgb(hex), b = rgb(toHex);
  return "#" + a.map((v, i) => clamp(v + ((b[i] ?? v) - v) * t).toString(16).padStart(2, "0")).join("");
}
export const INK = "#2a1f45";
export const C = { red: "#e0435f", pink: "#ff7aa8", blue: "#5aa7f0", lilac: "#8b7bff", navy: "#2f3a66", gold: "#f3c34a", goldDk: "#c99a1e", denim: "#4d7fc4", yellow: "#ffd54a", mint: "#5ed0a8", peach: "#ffb08a", white: "#fffaf3", silver: "#cfd6e4" };
export const starPath = (cx: number, cy: number, R: number, r: number) => Array.from({ length: 10 }, (_, i) => { const a = (Math.PI / 5) * i - Math.PI / 2; const rad = i % 2 ? r : R; return `${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`; }).join(" ");
export const scaleAbout = (x: number, y: number, s: number) => `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`;
export const HAIR = "#4a352c"; // facial hair

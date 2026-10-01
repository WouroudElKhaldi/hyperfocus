// Color palettes. Each one is a hue plus a light-mode and a dark-mode accent; every other color (backgrounds,
// borders, text, soft fills, shadows) is derived from them for BOTH light and dark mode, and contrast is
// checked in code so text stays readable. "lavender" is the original look: it adds nothing, the stylesheet's own colors apply.

export const PALETTE_GROUPS = [
  { id: "soft", label: "Soft and dreamy", palettes: [
    { id: "lavender", name: "Lavender", h: 258, light: "#7447e6", dark: "#a78bff" },
    { id: "rose", name: "Rose", h: 336, light: "#c2336f", dark: "#ff8fb8" },
    { id: "peach", name: "Peach", h: 22, light: "#c4521c", dark: "#ffa77a" },
  ] },
  { id: "fresh", label: "Fresh and calm", palettes: [
    { id: "mint", name: "Mint", h: 158, light: "#12805c", dark: "#5fd4a0" },
    { id: "sky", name: "Sky", h: 208, light: "#1c6fc4", dark: "#7dbaff" },
    { id: "lagoon", name: "Lagoon", h: 186, light: "#0b7a84", dark: "#52d1da" },
  ] },
  { id: "bold", label: "Bold and sharp", palettes: [
    { id: "midnight", name: "Midnight", h: 226, light: "#2748b5", dark: "#8aa4ff" },
    { id: "forest", name: "Forest", h: 132, light: "#2b7a31", dark: "#7bd47f" },
    { id: "crimson", name: "Crimson", h: 354, light: "#b3202f", dark: "#ff7b86" },
    { id: "copper", name: "Copper", h: 28, light: "#a5531d", dark: "#e8a066" },
    { id: "amber", name: "Amber", h: 42, light: "#8f6200", dark: "#f2c14e" },
  ] },
  { id: "minimal", label: "Minimal", palettes: [
    { id: "steel", name: "Steel", h: 214, t: 0.45, light: "#44607f", dark: "#9db8d8" },
    { id: "graphite", name: "Graphite", h: 220, t: 0.18, light: "#3b4048", dark: "#c4cad3" },
  ] },
];
export const PALETTES = PALETTE_GROUPS.flatMap((g) => g.palettes);
export const DEFAULT_PALETTE = "lavender";
export const getPaletteDef = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

// ---------- color math ----------
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const shade = (hex, dl) => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, l + dl); };

// push `hex` lighter or darker until it reads on `bg` (needed ratio), keeping its hue
function readable(hex, bg, need, dir) {
  let c = hex, guard = 0;
  while (contrast(c, bg) < need && guard++ < 40) c = shade(c, dir * 2);
  return c;
}

// All the colors for one palette in one mode. Returns { "--css-var": value }.
export function paletteTokens(p, mode) {
  const h = p.h, t = p.t ?? 1, S = (n) => clamp(Math.round(n * t), 0, 100);
  if (mode === "dark") {
    // soft on the eyes: low saturation, no pure white, and an accent that is toned down instead of neon
    const surface = hslToHex(h, S(15), 16);
    const [ah, as, al] = hexToHsl(p.dark);
    const accent = readable(hslToHex(ah, as * 0.78, Math.min(al, 74)), surface, 4.6, +1);
    const onDark = hslToHex(h, S(30), 10);
    return {
      "--bg": hslToHex(h, S(16), 11), "--bg-2": hslToHex(h, S(15), 13.5), "--surface": surface, "--surface-2": hslToHex(h, S(14), 20),
      "--line": hslToHex(h, S(13), 26), "--line-2": hslToHex(h, S(12), 33),
      "--ink": hslToHex(h, S(22), 91), "--ink-2": hslToHex(h, S(16), 79), "--muted": hslToHex(h, S(14), 67),
      "--accent": accent, "--accent-hover": shade(accent, +6), "--accent-strong": shade(accent, +8), "--accent-soft": hslToHex(h, S(26), 27),
      "--on-accent": contrast(onDark, accent) >= contrast("#ffffff", accent) ? onDark : "#ffffff",
      "--shadow-1": "0 1px 2px rgba(0,0,0,.4), 0 4px 14px rgba(0,0,0,.25)", "--shadow-2": "0 10px 34px rgba(0,0,0,.55)",
    };
  }
  const soft = hslToHex(h, S(100), 94);
  const accent = readable(p.light, "#ffffff", 4.6, -1);
  const strong = readable(shade(accent, -8), soft, 4.6, -1);
  const shadow = (a, b) => `0 1px 2px hsla(${h},${S(60)}%,25%,${a}), 0 4px 14px hsla(${h},${S(60)}%,25%,${b})`;
  return {
    "--bg": hslToHex(h, S(100), 97), "--bg-2": hslToHex(h, S(85), 94), "--surface": "#ffffff", "--surface-2": hslToHex(h, S(100), 98),
    "--line": hslToHex(h, S(60), 91), "--line-2": hslToHex(h, S(50), 85),
    "--ink": hslToHex(h, S(45), 16), "--ink-2": hslToHex(h, S(28), 28), "--muted": hslToHex(h, S(20), 40),
    "--accent": accent, "--accent-hover": shade(accent, -6), "--accent-strong": strong, "--accent-soft": soft,
    "--on-accent": "#ffffff",
    "--shadow-1": shadow(0.06, 0.06), "--shadow-2": `0 10px 34px hsla(${h},${S(60)}%,25%,.18)`,
  };
}

export const TOKEN_NAMES = Object.keys(paletteTokens(PALETTES[1], "light"));

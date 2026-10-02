import type { Strings } from "./en.ts";

// Pseudo-languages for testing (P3-19). Each turns the English words into look-alikes, so a word that doesn't change
// on screen was never made translatable; "en-XA" is also 40% longer (German and French run long) and "ar-XB" reads
// right to left, so the layout has to mirror. {{placeholders}} are kept as they are.

const ACCENTS: Record<string, string> = { a: "å", e: "é", i: "î", o: "ö", u: "ü", c: "ç", n: "ñ", s: "š", y: "ý", A: "Å", E: "É", I: "Î", O: "Ö", U: "Ü", C: "Ç", N: "Ñ", S: "Š" };
const words = (s: string, f: (part: string) => string) => s.split(/(\{\{\w+\}\})/).map((p) => (p.startsWith("{{") ? p : f(p))).join("");

/** "Today" → "⟦Ţöðåý·····⟧": accented, 40% longer, with brackets that show where every string starts and ends. */
export const accented = (s: string) => `⟦${words(s, (p) => p.replace(/[a-zA-Z]/g, (c) => ACCENTS[c] ?? c))}${"·".repeat(Math.ceil(s.length * 0.4))}⟧`;
/** "Today" → "‮⟦Today⟧‬": marked as right-to-left text. */
export const rtl = (s: string) => `‮⟦${s}⟧‬`;

type Tree = { [k: string]: string | Tree };
const mapTree = (t: Tree, f: (s: string) => string): Tree => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === "string" ? f(v) : mapTree(v, f)]));
export const pseudo = (en: Strings, f: (s: string) => string) => mapTree(en as unknown as Tree, f) as unknown as Strings;

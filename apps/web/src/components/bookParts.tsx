// Small pieces shared by the books list and the single-book page.
import type { BookLink, BookResult } from "../types.ts";

export const STATUS: Record<string, string> = { want: "📚 Want to read", reading: "📖 Reading", done: "✅ Finished" };
export const ICON: Record<string, string> = { free: "🆓", borrow: "📚", preview: "👀", buy: "🛒", info: "🔗" };
export const KIND: Record<string, string> = { free: "Free", borrow: "Borrow", preview: "Preview", buy: "Buy", info: "Info" };

/** The saved "find links" result of a book, or null when it was never searched (or can't be read). */
export function parse(result: string): BookResult | null {
  try { return result ? JSON.parse(result) : null; } catch { return null; }
}

// "Read or download free (Internet Archive)" is too long for a pill: show the kind and the source instead
export const short = (l: BookLink) => `${KIND[l.kind] || "Link"}${l.source ? " · " + l.source : ""}`;

// a readable address for a book: /books/12-clean-code (only the number matters, the words are for people)
export const slugOf = (title: string) => String(title || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
export const bookPath = (b: { id: number; title: string }) => `/books/${b.id}${slugOf(b.title) ? "-" + slugOf(b.title) : ""}`;

export function Pills({ items }: { items: BookLink[] }) {
  return (
    <div className="book-pills">
      {items.map((l) => (
        <a key={l.url} className={"blink " + l.kind} href={l.url} target="_blank" rel="noopener noreferrer" title={`${l.label}${l.matched ? " (matched: " + l.matched + ")" : ""}`}>
          <span aria-hidden="true">{ICON[l.kind]}</span> {short(l)}
        </a>
      ))}
    </div>
  );
}

// a small cover made from the title, so every book is easy to spot
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function Cover({ title, size = "" }: { title: string; size?: string }) {
  const h = hash(title || "book"), a = h % 360, b = (a + 40 + ((h >> 6) % 50)) % 360;
  const letters = (title || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
  return <span className={"book-cover " + size} style={{ background: `linear-gradient(150deg, hsl(${a} 55% 44%), hsl(${b} 60% 30%))` }} aria-hidden="true"><i>{letters}</i></span>;
}

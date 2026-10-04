import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { QUOTES, QUOTE_CATEGORIES } from "../data/quotes.ts";

// Quote settings live in this browser (not the database). They are read and written only through these helpers.
const KEY = "quotes-settings";
export type QuoteSettings = { on: boolean; everyMin: number; cats: string[] };
type Quote = { text: string; cat: string; id: number };
const DEFAULTS: QuoteSettings = { on: true, everyMin: 3, cats: QUOTE_CATEGORIES.map((c) => c.id) };
export function readQuoteSettings(): QuoteSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; }
}
export function writeQuoteSettings(s: QuoteSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage may be unavailable */ }
  window.dispatchEvent(new Event("quotes-settings"));
}

const SHOW_MS = 14000;

// A soft card that shows a short line every few minutes while the app is open. It never takes focus and never blocks anything.
export default function Quotes() {
  useTranslation(); // (re-renders this page when the language changes)
  const [settings, setSettings] = useState(readQuoteSettings);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [hover, setHover] = useState(false);
  const bag = useRef<Omit<Quote, "id">[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const on = () => setSettings(readQuoteSettings());
    window.addEventListener("quotes-settings", on);
    return () => window.removeEventListener("quotes-settings", on);
  }, []);

  // take the next line from a shuffled bag so nothing repeats until everything has been shown
  const next = useCallback(() => {
    if (!bag.current.length) {
      const all = settings.cats.flatMap((c) => (QUOTES[c] || []).map((text) => ({ text, cat: c })));
      bag.current = all.sort(() => Math.random() - 0.5);
    }
    return bag.current.pop() || null;
  }, [settings.cats.join(",")]);

  const show = useCallback(() => {
    // do not interrupt someone who is writing
    if (document.activeElement instanceof HTMLTextAreaElement && document.activeElement.value) return false;
    const q = next();
    if (!q) return false;
    setQuote({ ...q, id: Date.now() });
    return true;
  }, [next]);

  // the Settings page can ask for one right away
  useEffect(() => {
    const now = () => { const x = next(); if (x) setQuote({ ...x, id: Date.now() }); };
    window.addEventListener("quote-now", now);
    return () => window.removeEventListener("quote-now", now);
  }, [next]);

  useEffect(() => {
    bag.current = [];
    if (!settings.on) { setQuote(null); return; }
    let cancelled = false;
    const first = setTimeout(() => { if (!cancelled) show(); }, 40000);
    const every = setInterval(() => {
      if (cancelled) return;
      if (!show()) setTimeout(() => !cancelled && show(), 30000); // busy typing: try again shortly
    }, Math.max(1, settings.everyMin) * 60000);
    return () => { cancelled = true; clearTimeout(first); clearInterval(every); };
  }, [settings.on, settings.everyMin, settings.cats.join(","), show]);

  // hide by itself after a while, unless the mouse is over it
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (quote && !hover) hideTimer.current = setTimeout(() => setQuote(null), SHOW_MS);
    return () => clearTimeout(hideTimer.current);
  }, [quote?.id, hover]);

  if (!quote) return null;
  const cat = QUOTE_CATEGORIES.find((c) => c.id === quote.cat);

  return (
    <aside className={`quote-card q-${quote.cat}`} key={quote.id} role="status" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="q-head">
        <span className="q-tag"><i />{cat?.label}</span>
        <div className="row" style={{ gap: 0 }}>
          <button className="ghost icon-btn" onClick={() => { const q = next(); if (q) setQuote({ ...q, id: Date.now() }); }} aria-label={i18next.t("misc.anotherOne")} title={i18next.t("misc.anotherOne")}>↻</button>
          <button className="ghost icon-btn" onClick={() => setQuote(null)} aria-label={i18next.t("misc.close")}>✕</button>
        </div>
      </div>
      <p>{quote.text}</p>
      {!hover && <span className="q-timer" style={{ animationDuration: `${SHOW_MS}ms` }} />}
    </aside>
  );
}

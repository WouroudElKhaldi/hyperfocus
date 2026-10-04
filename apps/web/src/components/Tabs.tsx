import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";

// One idea at a time (owner, 2026-10-04: "an ADHD or AuDHD brain gets lost"): a row of big tabs, and only the open
// tab's content below. The open tab is in the address (#connections), so a link can open the right one and the
// browser's back button works. Arrow keys move between tabs (the usual tab pattern for keyboards and screen readers).

export type TabDef = { id: string; label: string; icon?: string; hint?: string };

/** The open tab, kept in the address's #part. */
export function useHashTab(tabs: readonly TabDef[], fallback: string): [string, (id: string) => void] {
  const read = () => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    return tabs.some((t) => t.id === h) ? h : fallback;
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const on = () => setTab(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [tabs.map((t) => t.id).join()]);
  const pick = (id: string) => {
    setTab(id);
    try { window.history.replaceState(window.history.state, "", `#${id}`); } catch { /* the tab just isn't in the address */ }
  };
  return [tab, pick];
}

export function Tabs({ label, tabs, value, onChange, children }: { label: string; tabs: readonly TabDef[]; value: string; onChange: (id: string) => void; children: ReactNode }) {
  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const rtl = document.documentElement.dir === "rtl" ? -1 : 1;
    const next = tabs[(i + step * rtl + tabs.length) % tabs.length];
    if (next) { onChange(next.id); document.getElementById(`tab-${next.id}`)?.focus(); }
  };
  const open = tabs.find((t) => t.id === value);
  return (
    <div className="tabs">
      <div className="tab-row" role="tablist" aria-label={label}>
        {tabs.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={t.id === value} aria-controls={`panel-${t.id}`} tabIndex={t.id === value ? 0 : -1}
            className={`tab-btn${t.id === value ? " on" : ""}`} onClick={() => onChange(t.id)} onKeyDown={keys}>
            {t.icon && <span aria-hidden="true">{t.icon}</span>}<span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="tab-panel" id={`panel-${value}`} role="tabpanel" aria-labelledby={`tab-${value}`}>
        {open?.hint && <p className="muted tab-hint">{open.hint}</p>}
        {children}
      </div>
    </div>
  );
}

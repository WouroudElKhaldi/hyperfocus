import { useEffect, useId, useRef, useState } from "react";
import { api } from "../api.ts";

// Typeahead over the taxonomy (P6-29): occupations, skills, majors, cities, countries, industries. Usable with the
// keyboard alone: type, ↓/↑ to move, Enter to pick, Escape to close (the ARIA combobox pattern, so screen readers
// announce it). Asks the server after a short pause, and only keeps the answer to the latest question.

export type TaxonomyKind = "occupation" | "skill" | "field" | "city" | "country" | "industry";
export type TaxonomyItem = { code: string; label: string; detail?: string };

export default function TaxonomyPicker({ kind, label, placeholder, onPick, autoFocus }: {
  kind: TaxonomyKind;
  label: string;
  placeholder?: string;
  onPick: (item: TaxonomyItem) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setItems([]); return; }
    const ask = ++latest.current;
    const t = setTimeout(() => {
      api.get(`/taxonomy/search?kind=${kind}&q=${encodeURIComponent(text)}&limit=8`).then(
        (r) => { if (ask === latest.current) { setItems(r.items.map((h) => ({ code: h.code, label: h.label, detail: h.detail }))); setActive(0); setOpen(true); } },
        () => { if (ask === latest.current) setItems([]); },
      );
    }, 150);
    return () => clearTimeout(t);
  }, [q, kind]);

  const pick = (item: TaxonomyItem | undefined) => {
    if (!item) return;
    onPick(item);
    setQ("");
    setItems([]);
    setOpen(false);
  };

  const listId = `${id}-list`;
  const showing = open && items.length > 0;
  return (
    <div className="taxonomy-picker">
      <label htmlFor={`${id}-input`} className="sr-only">{label}</label>
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showing ? `${id}-opt-${active}` : undefined}
        placeholder={placeholder ?? label}
        value={q}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && showing) { e.preventDefault(); pick(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showing && (
        <div id={listId} role="listbox" aria-label={label} className="taxonomy-options">
          {items.map((it, i) => (
            <div key={it.code} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              className={i === active ? "active" : ""} onMouseDown={(e) => { e.preventDefault(); pick(it); }} onMouseEnter={() => setActive(i)}>
              <b>{it.label}</b>{it.detail ? <small className="muted"> · {it.detail}</small> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

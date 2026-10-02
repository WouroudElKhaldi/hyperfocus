import { REMINDER_REPEATS, type ReminderRepeat } from "@hyperfocus/shared/constants";
import { useEffect, useState } from "react";
import { api, errorOf, oneOf } from "../api.ts";
import { useToast } from "../App.tsx";
import More from "./More.tsx";
import type { Reminder } from "../types.ts";

const REPEATS: [string, string][] = [["none", "Just once"], ["daily", "Every day"], ["weekdays", "Weekdays"], ["weekly", "Every week"]];
const pad = (n: number) => String(n).padStart(2, "0");
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const inMin = (m: number) => new Date(Date.now() + m * 60000);
const nextAt = (h: number, plusDay = 0) => { const d = new Date(); d.setDate(d.getDate() + plusDay); d.setHours(h, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d; };
const QUICK: [string, () => Date][] = [
  ["In 10 min", () => inMin(10)],
  ["In 30 min", () => inMin(30)],
  ["In 1 hour", () => inMin(60)],
  ["This evening", () => nextAt(19)],
  ["Tomorrow morning", () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; }],
];

function whenLabel(iso: string | Date) {
  const d = new Date(iso), n = new Date(), t = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((t(d) - t(n)) / 864e5);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

// Reminders she writes herself. `compact` is the small version on the Today page.
export default function MyReminders({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const [list, setList] = useState<Reminder[] | null>(null);
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(() => toInput(inMin(60)));
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/reminders").then(setList).catch((e) => { toast(e.message, "err"); setList([]); });
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);

  const create = async (when: Date) => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await api.post("/reminders", { title, at: when.toISOString(), repeat });
      toast(`I'll remind you ${whenLabel(when).toLowerCase()}.`);
      setTitle(""); setRepeat("none");
      await load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };
  const remove = async (r: Reminder) => { await api.del(`/reminders/${r.id}`); load(); };
  const again = async (r: Reminder) => { await api.patch(`/reminders/${r.id}`, { at: inMin(10).toISOString() }); load(); toast("Okay, in 10 minutes."); };

  const upcoming = (list || []).filter((r) => !r.done);
  const past = (list || []).filter((r) => r.done);
  const shown = compact ? upcoming.slice(0, 3) : upcoming;

  return (
    <div className="card my-rem">
      <h2>{compact ? "Reminders" : "My reminders"}</h2>
      {!compact && <p className="muted">Write what you want to be reminded about, then pick when. A Windows notification pops up (the app needs to be running).</p>}

      <form className="rem-add" onSubmit={(e) => { e.preventDefault(); const t = new Date(at); create(t > new Date() ? t : inMin(60)); }}>
        <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Remind me to…" aria-label="What should I remind you about?" />
        <div className="chip-row" role="group" aria-label="When">
          {QUICK.map(([label, fn]) => <button type="button" key={label} className="trait" disabled={!title.trim() || busy} onClick={() => create(fn())}>{label}</button>)}
        </div>
        <More label="Pick an exact time or repeat" className="inline">
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Date and time" />
          <select value={repeat} onChange={(e) => setRepeat(oneOf(REMINDER_REPEATS, e.target.value, "none"))} aria-label="Repeat">
            {REPEATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="primary" disabled={!title.trim() || !at || busy}>Add reminder</button>
        </More>
      </form>

      {list !== null && shown.length === 0 && <p className="muted rem-empty">No reminders waiting.</p>}
      {shown.length > 0 && (
        <ul className="rem-list">
          {shown.map((r) => (
            <li key={r.id}>
              <div className="grow"><b>{r.title}</b><div className="muted tiny">{whenLabel(r.at)}{r.repeat !== "none" ? ` · ${REPEATS.find(([k]) => k === r.repeat)?.[1].toLowerCase()}` : ""}</div></div>
              <button className="ghost danger" onClick={() => remove(r)} aria-label={`Delete reminder ${r.title}`}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      {compact && upcoming.length > 3 && <p className="muted tiny">And {upcoming.length - 3} more in Settings.</p>}

      {!compact && past.length > 0 && (
        <More label={`Recently sent (${past.length})`} className="in-card">
          <ul className="rem-list">
            {past.map((r) => (
              <li key={r.id}>
                <div className="grow"><b>{r.title}</b><div className="muted tiny">Sent {whenLabel(r.lastFiredAt || r.at)}</div></div>
                <button className="ghost" onClick={() => again(r)}>Remind me again</button>
                <button className="ghost danger" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}>Delete</button>
              </li>
            ))}
          </ul>
        </More>
      )}
    </div>
  );
}

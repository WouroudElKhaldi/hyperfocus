import { type FormEvent, useMemo, useState } from "react";
import { useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import type { Win, WinsSummary } from "../../../types.ts";
import { useAddWin, useDeleteWin, useWins } from "../api.ts";

const ICON: Record<string, string> = { win: "🏆", task: "✅", post: "💼", study: "📚" };
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

export default function Wins() {
  const toast = useToast();
  const wins = useWins().data ?? [];
  const addWin = useAddWin();
  const deleteWin = useDeleteWin();
  const [text, setText] = useState("");
  const [summary, setSummary] = useState<WinsSummary | null>(null);
  const summarize = useApiChange("post", "/wins/summary", { onSuccess: setSummary });
  const busy = summarize.isPending;

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addWin.mutate(text, { onSuccess: () => { setText(""); toast("Logged 🏆 You did that."); } });
  };
  const remove = (w: Win) => { if (w.winId) deleteWin.mutate(w.winId); };
  const makeSummary = () => summarize.mutate(undefined);
  const copy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary.bullets.map((b) => `• ${b}`).join("\n") + "\n\n" + summary.paragraph);
    toast("Copied");
  };

  const days = useMemo(() => {
    const g: { k: string; items: Win[] }[] = [];
    for (const w of wins) {
      const k = dayLabel(w.date);
      let d = g.find((x) => x.k === k);
      if (!d) g.push((d = { k, items: [] }));
      d.items.push(w);
    }
    return g;
  }, [wins]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Wins</h1>
          <p className="sub">Proof of what you've done. Finished tasks, study sessions and published posts land here by themselves.</p>
        </div>
        <button className="primary big" disabled={busy || wins.length < 3} onClick={makeSummary}>{busy ? "Writing…" : "✨ Make my talking points"}</button>
      </div>

      <form className="card row" onSubmit={add}>
        <input className="grow" placeholder="Something I did that I'm proud of (big or small)…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={!text.trim()}>Add win</button>
      </form>

      {summary && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>For a review, a promotion talk or your CV</h2>
            <div className="row"><button onClick={copy}>Copy</button><button className="ghost" onClick={() => setSummary(null)}>Hide</button></div>
          </div>
          {summary.bullets.map((b, i) => <p key={i} style={{ margin: "var(--s-1) 0" }}>• {b}</p>)}
          <p className="pre" style={{ marginTop: "var(--s-3)" }}>{summary.paragraph}</p>
          <p className="muted tiny">Built only from your entries below, nothing invented. Edit it before you use it.</p>
        </div>
      )}

      {days.length === 0 && <div className="empty">Nothing yet. Write your first win above, even "I opened the app".</div>}
      {days.map((d) => (
        <div className="card" key={d.k}>
          <h2>{d.k}</h2>
          {d.items.map((w) => (
            <div className="item" key={w.id}>
              <span>{ICON[w.kind]}</span>
              <div className="grow">{w.text}</div>
              {w.manual && <button className="ghost" onClick={() => remove(w)}>✕</button>}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

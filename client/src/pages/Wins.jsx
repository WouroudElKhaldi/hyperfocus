import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../App.jsx";

const ICON = { win: "🏆", task: "✅", post: "💼", study: "📚" };
const dayLabel = (iso) => new Date(iso).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

export default function Wins() {
  const toast = useToast();
  const [wins, setWins] = useState([]);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/wins").then(setWins).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api.post("/wins", { text }); setText(""); toast("Logged 🏆 You did that."); load(); }
    catch (err) { toast(err.message, "err"); }
  };
  const remove = async (w) => { await api.del(`/wins/${w.winId}`); load(); };
  const makeSummary = async () => {
    setBusy(true);
    try { setSummary(await api.post("/wins/summary")); }
    catch (e) { toast(e.message, "err"); }
    setBusy(false);
  };
  const copy = () => {
    navigator.clipboard.writeText(summary.bullets.map((b) => `• ${b}`).join("\n") + "\n\n" + summary.paragraph);
    toast("Copied");
  };

  const days = useMemo(() => {
    const g = [];
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

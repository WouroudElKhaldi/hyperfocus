import { useEffect, useRef, useState } from "react";
import MyReminders from "../components/MyReminders.jsx";
import { Link } from "react-router-dom";
import { api, KINDS } from "../api.js";
import { useToast } from "../App.jsx";
import More from "../components/More.jsx";
import { useProfile } from "../hooks/useProfile.js";

function FocusTimer() {
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const toast = useToast();
  const id = useRef();

  useEffect(() => {
    if (!running) return;
    id.current = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => clearInterval(id.current);
  }, [running]);
  useEffect(() => {
    if (secs <= 0 && running) {
      setRunning(false);
      setSecs(25 * 60);
      toast("Focus round done. Stand up, drink water 💧");
    }
  }, [secs, running, toast]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <div className="card">
      <h2>Focus round</h2>
      <div className="timer">{mm}:{ss}</div>
      <div className="row" style={{ marginTop: "var(--s-2)" }}>
        <button className="primary" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</button>
        <button onClick={() => { setRunning(false); setSecs(5 * 60); }}>5 min (tiny start)</button>
        <button onClick={() => { setRunning(false); setSecs(25 * 60); }}>25 min</button>
      </div>
      <p className="muted">Can't start? Pick 5 minutes. Starting is the whole job.</p>
    </div>
  );
}

export default function Today() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [kind, setKind] = useState("thought");
  const [sorted, setSorted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [recent, setRecent] = useState([]);

  const load = () => {
    api.get("/tasks").then((t) => setTasks(t.filter((x) => x.today && !x.done))).catch((e) => toast(e.message, "err"));
    api.get("/notes").then((n) => setRecent(n.filter((x) => !x.archived && !x.posted).slice(0, 4))).catch(() => {});
  };
  useEffect(load, []);

  const save = async () => {
    try {
      await api.post("/notes", { kind, body: text });
      setText("");
      toast("Saved. It's out of your head now 💜");
      load();
    } catch (e) { toast(e.message, "err"); }
  };

  const sortIt = async () => {
    setBusy(true);
    try { setSorted((await api.post("/ai/organize", { text })).items); }
    catch (e) { toast(e.message, "err"); }
    setBusy(false);
  };

  const saveSorted = async () => {
    for (const it of sorted) {
      if (it.kind === "task") await api.post("/tasks", { title: it.title });
      else await api.post("/notes", { kind: it.kind, title: it.title, body: it.body });
    }
    setSorted(null); setText(""); toast(`Saved ${sorted.length} items`); load();
  };

  const complete = async (t) => { await api.patch(`/tasks/${t.id}`, { done: true }); toast("Done! 🎉"); load(); };

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Hey" : "Good evening";
  const first = (useProfile()?.name || "").trim().split(" ")[0];

  return (
    <>
      <h1>{hello}{first ? `, ${first}` : ""}</h1>
      <p className="sub">One thing at a time. Dump first, sort later.</p>

      <div className="grid2">
        <div className="card">
          <h2>Today</h2>
          {tasks.length === 0 && <div className="empty">Nothing picked for today. <Link to="/tasks">Choose up to 3</Link></div>}
          {tasks.map((t) => (
            <div className="item" key={t.id}>
              <input type="checkbox" className="check" onChange={() => complete(t)} />
              <div>{t.title}</div>
            </div>
          ))}
        </div>
        <FocusTimer />
      </div>

      <MyReminders compact />

      <div className="card">
        <h2>Brain dump</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Whatever is in your head right now. Messy is fine." />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <button className="primary" disabled={!text.trim()} onClick={save}>Save</button>
        </div>
        <More label="More ways to save" className="in-card">
          <div className="row">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What kind of thing is this?">
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button disabled={!text.trim() || busy} onClick={sortIt}>{busy ? "Sorting…" : "Sort it for me (AI)"}</button>
          </div>
        </More>
        {sorted && (
          <div style={{ marginTop: "var(--s-4)" }}>
            <p className="muted">AI split it into {sorted.length} items. Save them all, or dismiss.</p>
            {sorted.map((it, i) => (
              <div className="item" key={i}>
                <span className="chip">{it.kind === "task" ? "✅ Task" : KINDS[it.kind] || it.kind}</span>
                <div><b>{it.title}</b><div className="muted">{it.body}</div></div>
              </div>
            ))}
            <div className="row" style={{ marginTop: "var(--s-3)" }}>
              <button className="primary" onClick={saveSorted}>Save all</button>
              <button className="ghost" onClick={() => setSorted(null)}>Dismiss</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <More label="Recently saved" className="plain">
        {recent.length === 0 && <div className="empty">Nothing yet.</div>}
        {recent.map((n) => (
          <div className="item" key={n.id}>
            <span className="chip">{KINDS[n.kind]}</span>
            <div className="pre grow">{n.title && <b>{n.title}<br /></b>}{n.body.slice(0, 160)}</div>
          </div>
        ))}
        </More>
      </div>
    </>
  );
}

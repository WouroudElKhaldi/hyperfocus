import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../App.jsx";
import More from "../components/More.jsx";

// More important tasks earn more points for your companion.
const PRIORITIES = [
  { id: "low", label: "Low", pts: 2 },
  { id: "normal", label: "Normal", pts: 4 },
  { id: "high", label: "Important", pts: 8 },
  { id: "urgent", label: "Critical", pts: 14 },
];
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function Tasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [busyId, setBusyId] = useState(null);

  const load = () => api.get("/tasks").then(setTasks).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post("/tasks", { title, priority });
    setTitle("");
    load();
  };
  const toggle = async (t) => { await api.patch(`/tasks/${t.id}`, { done: !t.done }); load(); };
  const setToday = async (t) => {
    const count = tasks.filter((x) => x.today && !x.done).length;
    if (!t.today && count >= 3) return toast("3 is plenty for today. Finish one first 💜", "err");
    await api.patch(`/tasks/${t.id}`, { today: !t.today });
    load();
  };
  const setDue = async (t, v) => { await api.patch(`/tasks/${t.id}`, { dueDay: v || null }); load(); };
  const setPrio = async (t, p) => { await api.patch(`/tasks/${t.id}`, { priority: p }); load(); };
  const remove = async (t) => { await api.del(`/tasks/${t.id}`); load(); };
  const removeStep = async (s) => { await api.del(`/steps/${s.id}`); load(); };
  const clearSteps = async (t) => { await Promise.all(t.steps.map((s) => api.del(`/steps/${s.id}`))); load(); };
  const stepToggle = async (s) => { await api.patch(`/steps/${s.id}`, { done: !s.done }); load(); };
  const breakDown = async (t) => {
    setBusyId(t.id);
    try {
      const { steps } = await api.post("/ai/steps", { task: t.title });
      await api.post(`/tasks/${t.id}/steps`, { steps });
      load();
    } catch (e) { toast(e.message, "err"); }
    setBusyId(null);
  };

  // the most important things first
  const open = tasks.filter((t) => !t.done).sort((a, b) => RANK[a.priority] - RANK[b.priority]);
  const done = tasks.filter((t) => t.done);
  const pts = (id) => PRIORITIES.find((p) => p.id === id)?.pts ?? 10;

  const row = (t) => (
    <div className="item" key={t.id}>
      <input type="checkbox" className="check" checked={t.done} onChange={() => toggle(t)} aria-label={`Done: ${t.title}`} />
      <div className="grow">
        <div className="row" style={{ gap: "var(--s-2)", flexWrap: "nowrap" }}>
          <span className={"grow" + (t.done ? " done" : "")}>{t.title}</span>
          <span className={"prio p-" + t.priority} title="Points for your companion when you finish it">+{pts(t.priority)}</span>
        </div>
        {t.steps.length > 0 && (
          <div className="steps">
            {t.steps.map((s) => (
              <div key={s.id} className="step-row">
                <label className={s.done ? "done" : ""}>
                  <input type="checkbox" checked={s.done} onChange={() => stepToggle(s)} /> {s.text}
                </label>
                <button className="ghost icon-btn" onClick={() => removeStep(s)} aria-label={`Remove step: ${s.text}`} title="Remove this step">✕</button>
              </div>
            ))}
          </div>
        )}
        {!t.done && (
          <div className="row" style={{ marginTop: "var(--s-2)" }}>
            <button className="ghost" onClick={() => setToday(t)}>{t.today ? "In today ✓" : "Add to today"}</button>
            {t.steps.length === 0 && (
              <button className="ghost" disabled={busyId === t.id} onClick={() => breakDown(t)}>
                {busyId === t.id ? "Thinking…" : "Tiny steps (AI)"}
              </button>
            )}
            <More label="Options" className="inline">
              <select className="mini-select" value={t.priority} onChange={(e) => setPrio(t, e.target.value)} aria-label="How important">
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label} (+{p.pts})</option>)}
              </select>
              <input type="date" className="mini-date" title="Due date (shows on the calendar)" value={t.dueDay || ""} onChange={(e) => setDue(t, e.target.value)} />
              {t.steps.length > 0 && <button className="ghost" onClick={() => clearSteps(t)}>Remove all tiny steps</button>}
              <button className="ghost danger" onClick={() => remove(t)}>Delete task</button>
            </More>
          </div>
        )}
        {t.done && (
          <div className="row" style={{ marginTop: "var(--s-1)" }}>
            <button className="ghost danger" onClick={() => remove(t)}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <h1>Tasks</h1>
      <p className="sub">Add a task, then tick it off. Stuck on one? Try "Tiny steps".</p>
      <form className="card row" onSubmit={add}>
        <input className="grow" placeholder="New task…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New task" />
        <button className="primary">Add</button>
        <More label="How important?" className="inline">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="How important">
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label} (+{p.pts})</option>)}
          </select>
        </More>
      </form>
      <div className="card">
        {open.length === 0 && <div className="empty">All clear. Nothing waiting.</div>}
        {open.map(row)}
      </div>
      {done.length > 0 && (
        <div className="card">
          <h2>Done ({done.length})</h2>
          {done.map(row)}
        </div>
      )}
    </>
  );
}

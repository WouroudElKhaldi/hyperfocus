import { useEffect, useState } from "react";
import More from "../components/More.tsx";
import { api, errorOf } from "../api.ts";
import { useToast } from "../App.tsx";
import type { Goal, GoalAction, GoalAnalysis, GoalLog } from "../types.ts";

const VERDICT: Record<string, { label: string; cls: string }> = {
  achievable: { label: "✅ Achievable", cls: "v-ok" },
  stretch: { label: "🌱 A stretch", cls: "v-mid" },
  unrealistic: { label: "⚠️ Not realistic as planned", cls: "v-bad" },
};
const dayStr = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const daysLeft = (d: string) => Math.round((Date.parse(dayStr(d)) - Date.parse(todayStr())) / 86400000);

// Top-level (not nested) so typing in its inputs never loses focus when the list re-renders.
function GoalCard({ goal, onChange, onDelete }: { goal: Goal; onChange: (g: Goal) => void; onDelete: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [proposed, setProposed] = useState<string[]>([]);
  const [newAction, setNewAction] = useState("");
  const [logText, setLogText] = useState("");
  const [original, setOriginal] = useState(goal.original);

  const patch = async (body: Partial<Goal>) => onChange(await api.patch<Goal>(`/goals/${goal.id}`, body));
  const analyze = async () => {
    setBusy(true);
    try {
      const out = await api.post<GoalAnalysis>(`/goals/${goal.id}/analyze`);
      onChange(out.goal);
      setProposed(out.actions);
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };
  const addActions = async (texts: string[]) => {
    onChange(await api.post<Goal>(`/goals/${goal.id}/actions`, { texts }));
    setNewAction("");
  };
  const toggleAction = async (a: GoalAction) => {
    await api.patch(`/goal-actions/${a.id}`, { done: !a.done });
    onChange({ ...goal, actions: goal.actions.map((x) => (x.id === a.id ? { ...x, done: !a.done } : x)) });
  };
  const delAction = async (a: GoalAction) => {
    await api.del(`/goal-actions/${a.id}`);
    onChange({ ...goal, actions: goal.actions.filter((x) => x.id !== a.id) });
  };
  const addLog = async () => {
    if (!logText.trim()) return;
    onChange(await api.post<Goal>(`/goals/${goal.id}/logs`, { text: logText }));
    setLogText("");
  };
  const delLog = async (l: GoalLog) => {
    await api.del(`/goal-logs/${l.id}`);
    onChange({ ...goal, logs: goal.logs.filter((x) => x.id !== l.id) });
  };

  const doneCount = goal.actions.filter((a) => a.done).length;
  const pct = goal.actions.length ? Math.round((doneCount / goal.actions.length) * 100) : 0;
  const left = goal.targetDate ? daysLeft(goal.targetDate) : null;
  const v = VERDICT[goal.verdict];
  const changed = original !== goal.original;

  return (
    <div className={"card goal" + (goal.status !== "active" ? " faded" : "")}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className={"chip " + (goal.status === "achieved" ? "posted" : "")}>
          {goal.status === "achieved" ? "Achieved" : goal.status === "paused" ? "Paused" : "Active"}
        </span>
        <div className="row">
          {goal.status !== "achieved" && <button className="ghost" onClick={() => patch({ status: "achieved" })}>Mark achieved</button>}
          <More label="More" className="inline">
            {goal.status === "active" && <button className="ghost" onClick={() => patch({ status: "paused" })}>Pause</button>}
            {goal.status !== "active" && <button className="ghost" onClick={() => patch({ status: "active" })}>Reactivate</button>}
            <button className="ghost danger" onClick={onDelete}>Delete</button>
          </More>
        </div>
      </div>

      <div className="section"><h3>The what</h3>
        <textarea style={{ minHeight: 70 }} value={original} onChange={(e) => setOriginal(e.target.value)} onBlur={() => changed && patch({ original })} />
        {goal.refined && (
          <div className="refined">
            <div className="muted">Sharper version (AI, same meaning)</div>
            <div className="pre">{goal.refined}</div>
            <button className="ghost" onClick={() => { navigator.clipboard.writeText(goal.refined); toast("Copied"); }}>Copy</button>
            <button className="ghost" onClick={() => { setOriginal(goal.refined); patch({ original: goal.refined }); }}>Use it as my goal</button>
          </div>
        )}
      </div>

      <div className="section"><h3>The when</h3>
        <div className="row">
          <input type="date" style={{ width: "auto" }} value={dayStr(goal.targetDate)} onChange={(e) => patch({ targetDate: e.target.value || null })} />
          {left !== null && goal.status === "active" && (
            <span className="chip">{left > 0 ? `${left} days left` : left === 0 ? "Today!" : `${-left} days overdue`}</span>
          )}
          {left === null && <span className="muted">No date yet. Ask the AI to judge, or pick one.</span>}
        </div>
      </div>

      <More label="Is it realistic? (AI check)" className="in-card" open={!!goal.verdict}>
      <div>
        <button className="primary" disabled={busy} onClick={analyze}>
          {busy ? "Thinking…" : goal.verdict ? "✨ Re-check with AI" : "✨ Rephrase & check with AI"}
        </button>
        {v && (
          <div className={"verdict " + v.cls}>
            <b>{v.label}</b>
            <p className="pre">{goal.verdictNote}</p>
            {goal.suggestion && <p className="pre"><b>Suggestion:</b> {goal.suggestion}</p>}
            <div className="muted">The AI uses your date and your logged study hours. It can be wrong, you decide.</div>
          </div>
        )}
      </div>
      </More>

      <div className="section"><h3>The how (my plan)</h3>
        {goal.actions.length > 0 && <div className="bar" style={{ marginBottom: "var(--s-2)" }}><div style={{ width: pct + "%" }} /></div>}
        <div className="steps">
          {goal.actions.map((a) => (
            <label key={a.id} className={a.done ? "done" : ""}>
              <input type="checkbox" checked={a.done} onChange={() => toggleAction(a)} />
              <span className="grow">{a.text}</span>
              <button className="ghost" onClick={(e) => { e.preventDefault(); delAction(a); }}>✕</button>
            </label>
          ))}
        </div>
        {proposed.length > 0 && (
          <div className="refined">
            <div className="muted">AI suggested steps</div>
            {proposed.map((p, i) => <div key={i}>• {p}</div>)}
            <button className="primary" style={{ marginTop: "var(--s-2)" }} onClick={() => { addActions(proposed); setProposed([]); }}>Add all to my plan</button>
            <button className="ghost" onClick={() => setProposed([])}>Dismiss</button>
          </div>
        )}
        <div className="row" style={{ marginTop: "var(--s-2)" }}>
          <input className="grow" placeholder="Add a step…" value={newAction} onChange={(e) => setNewAction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newAction.trim() && addActions([newAction])} />
          <button disabled={!newAction.trim()} onClick={() => addActions([newAction])}>Add</button>
        </div>
      </div>

      <More label="My progress log" className="in-card">
      <div>
        <div className="row">
          <input className="grow" placeholder="What did you do toward this today?" value={logText} onChange={(e) => setLogText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLog()} />
          <button disabled={!logText.trim()} onClick={addLog}>Log it</button>
        </div>
        {goal.logs.map((l) => (
          <div className="item" key={l.id}>
            <span className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(l.createdAt).toLocaleDateString([], { day: "numeric", month: "short" })}</span>
            <div className="grow pre">{l.text}</div>
            <button className="ghost" onClick={() => delLog(l)}>✕</button>
          </div>
        ))}
      </div>
      </More>
    </div>
  );
}

export default function Goals() {
  const toast = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => { api.get<Goal[]>("/goals").then(setGoals).catch((e) => toast(e.message, "err")); }, []);

  const add = async () => {
    try {
      const g = await api.post<Goal>("/goals", { original: text, targetDate: date || null });
      setGoals([g, ...goals]);
      setText(""); setDate("");
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const replace = (g: Goal) => setGoals((list) => list.map((x) => (x.id === g.id ? g : x)));
  const remove = async (g: Goal) => {
    if (!confirm("Delete this goal and its plan?")) return;
    await api.del(`/goals/${g.id}`);
    setGoals((list) => list.filter((x) => x.id !== g.id));
  };

  return (
    <>
      <h1>Goals</h1>
      <p className="sub">What do I want, by when, is it realistic, and how will I do it?</p>
      <div className="card">
        <h2>New goal</h2>
        <textarea style={{ minHeight: 80 }} placeholder="In your own words, what do you want? e.g. become a senior engineer…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <label className="muted">By when? <input type="date" style={{ width: "auto" }} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="primary" disabled={!text.trim()} onClick={add}>Add goal</button>
        </div>
      </div>
      {goals.length === 0 && <div className="empty">No goals yet. Write the first one, messy is fine.</div>}
      {goals.map((g) => <GoalCard key={g.id} goal={g} onChange={replace} onDelete={() => remove(g)} />)}
    </>
  );
}

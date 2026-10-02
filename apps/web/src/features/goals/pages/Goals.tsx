import { useState } from "react";
import More from "../../../components/More.tsx";
import { useToast } from "../../../App.tsx";
import type { Goal, GoalAction, GoalLog } from "../../../types.ts";
import { useAddGoal, useDeleteGoal, useGoalChanges, useGoals } from "../api.ts";

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
function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const toast = useToast();
  const change = useGoalChanges(goal.id);
  const busy = change.analyze.isPending;
  const [proposed, setProposed] = useState<string[]>([]);
  const [newAction, setNewAction] = useState("");
  const [logText, setLogText] = useState("");
  const [original, setOriginal] = useState(goal.original);

  const patch = (body: Parameters<typeof change.update.mutate>[0]) => change.update.mutate(body);
  const analyze = () => change.analyze.mutate(undefined, { onSuccess: (out) => setProposed(out.actions) });
  const addActions = (texts: string[]) => change.addActions.mutate(texts, { onSuccess: () => setNewAction("") });
  const toggleAction = (a: GoalAction) => change.toggleAction.mutate(a);
  const delAction = (a: GoalAction) => change.deleteAction.mutate(a.id);
  const addLog = () => {
    if (!logText.trim()) return;
    change.addLog.mutate(logText, { onSuccess: () => setLogText("") });
  };
  const delLog = (l: GoalLog) => change.deleteLog.mutate(l.id);

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
  const goals = useGoals().data ?? [];
  const addGoal = useAddGoal();
  const deleteGoal = useDeleteGoal();
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  const add = () => addGoal.mutate({ original: text, targetDate: date || null }, { onSuccess: () => { setText(""); setDate(""); } });
  const remove = (g: Goal) => { if (confirm("Delete this goal and its plan?")) deleteGoal.mutate(g.id); };

  return (
    <>
      <h1>Goals</h1>
      <p className="sub">What do I want, by when, is it realistic, and how will I do it?</p>
      <div className="card">
        <h2>New goal</h2>
        <textarea style={{ minHeight: 80 }} placeholder="In your own words, what do you want? e.g. become a senior engineer…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <label className="muted">By when? <input type="date" style={{ width: "auto" }} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="primary" disabled={!text.trim() || addGoal.isPending} onClick={add}>Add goal</button>
        </div>
      </div>
      {goals.length === 0 && <div className="empty">No goals yet. Write the first one, messy is fine.</div>}
      {goals.map((g) => <GoalCard key={g.id} goal={g} onDelete={() => remove(g)} />)}
    </>
  );
}

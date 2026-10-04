import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import More from "../../../components/More.tsx";
import { useToast } from "../../../App.tsx";
import type { Goal, GoalAction, GoalLog } from "../../../types.ts";
import { useAddGoal, useDeleteGoal, useGoalChanges, useGoals } from "../api.ts";

const VERDICT: Record<string, { label: string; cls: string }> = {
  achievable: { label: i18next.t("goals.achievable"), cls: "v-ok" },
  stretch: { label: i18next.t("goals.aStretch"), cls: "v-mid" },
  unrealistic: { label: i18next.t("goals.notRealisticAsPlanned"), cls: "v-bad" },
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
          {goal.status === "achieved" ? i18next.t("goals.achieved") : goal.status === "paused" ? i18next.t("goals.paused") : i18next.t("goals.active")}
        </span>
        <div className="row">
          {goal.status !== "achieved" && <button className="ghost" onClick={() => patch({ status: "achieved" })}>{i18next.t("goals.markAchieved")}</button>}
          <More label={i18next.t("goals.more")} className="inline">
            {goal.status === "active" && <button className="ghost" onClick={() => patch({ status: "paused" })}>{i18next.t("goals.pause")}</button>}
            {goal.status !== "active" && <button className="ghost" onClick={() => patch({ status: "active" })}>{i18next.t("goals.reactivate")}</button>}
            <button className="ghost danger" onClick={onDelete}>{i18next.t("goals.delete")}</button>
          </More>
        </div>
      </div>

      <div className="section"><h3>{i18next.t("goals.theWhat")}</h3>
        <textarea style={{ minHeight: 70 }} value={original} onChange={(e) => setOriginal(e.target.value)} onBlur={() => changed && patch({ original })} />
        {goal.refined && (
          <div className="refined">
            <div className="muted">{i18next.t("goals.sharperVersionAiSame")}</div>
            <div className="pre">{goal.refined}</div>
            <button className="ghost" onClick={() => { navigator.clipboard.writeText(goal.refined); toast(i18next.t("goals.copied")); }}>{i18next.t("goals.copy")}</button>
            <button className="ghost" onClick={() => { setOriginal(goal.refined); patch({ original: goal.refined }); }}>{i18next.t("goals.useItAsMy")}</button>
          </div>
        )}
      </div>

      <div className="section"><h3>{i18next.t("goals.theWhen")}</h3>
        <div className="row">
          <input type="date" style={{ width: "auto" }} value={dayStr(goal.targetDate)} onChange={(e) => patch({ targetDate: e.target.value || null })} />
          {left !== null && goal.status === "active" && (
            <span className="chip">{left > 0 ? `${left} days left` : left === 0 ? i18next.t("goals.today") : `${-left} days overdue`}</span>
          )}
          {left === null && <span className="muted">{i18next.t("goals.noDateYetAsk")}</span>}
        </div>
      </div>

      <More label={i18next.t("goals.isItRealisticAi")} className="in-card" open={!!goal.verdict}>
      <div>
        <button className="primary" disabled={busy} onClick={analyze}>
          {busy ? i18next.t("goals.thinking") : goal.verdict ? i18next.t("goals.reCheckWithAi") : i18next.t("goals.rephraseCheckWithAi")}
        </button>
        {v && (
          <div className={"verdict " + v.cls}>
            <b>{v.label}</b>
            <p className="pre">{goal.verdictNote}</p>
            {goal.suggestion && <p className="pre"><b>{i18next.t("goals.suggestion")}</b> {goal.suggestion}</p>}
            <div className="muted">{i18next.t("goals.theAiUsesYour")}</div>
          </div>
        )}
      </div>
      </More>

      <div className="section"><h3>{i18next.t("goals.theHowMyPlan")}</h3>
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
            <div className="muted">{i18next.t("goals.aiSuggestedSteps")}</div>
            {proposed.map((p, i) => <div key={i}>• {p}</div>)}
            <button className="primary" style={{ marginTop: "var(--s-2)" }} onClick={() => { addActions(proposed); setProposed([]); }}>{i18next.t("goals.addAllToMy")}</button>
            <button className="ghost" onClick={() => setProposed([])}>{i18next.t("goals.dismiss")}</button>
          </div>
        )}
        <div className="row" style={{ marginTop: "var(--s-2)" }}>
          <input className="grow" placeholder={i18next.t("goals.addAStep")} value={newAction} onChange={(e) => setNewAction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newAction.trim() && addActions([newAction])} />
          <button disabled={!newAction.trim()} onClick={() => addActions([newAction])}>{i18next.t("goals.add")}</button>
        </div>
      </div>

      <More label={i18next.t("goals.myProgressLog")} className="in-card">
      <div>
        <div className="row">
          <input className="grow" placeholder={i18next.t("goals.whatDidYouDo")} value={logText} onChange={(e) => setLogText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLog()} />
          <button disabled={!logText.trim()} onClick={addLog}>{i18next.t("goals.logIt")}</button>
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
  useTranslation(); // (re-renders this page when the language changes)
  const goals = useGoals().data ?? [];
  const addGoal = useAddGoal();
  const deleteGoal = useDeleteGoal();
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  // the box empties right away (so the goal never shows twice) and gets the text back if the server says no
  const add = () => {
    const typed = { text, date };
    setText(""); setDate("");
    addGoal.mutate({ original: typed.text, targetDate: typed.date || null }, { onError: () => { setText(typed.text); setDate(typed.date); } });
  };
  const remove = (g: Goal) => { if (confirm(i18next.t("goals.deleteThisGoalAnd"))) deleteGoal.mutate(g.id); };

  return (
    <>
      <h1>{i18next.t("goals.goals")}</h1>
      <p className="sub">{i18next.t("goals.whatDoIWant")}</p>
      <div className="card">
        <h2>{i18next.t("goals.newGoal")}</h2>
        <textarea style={{ minHeight: 80 }} placeholder={i18next.t("goals.inYourOwnWords")} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <label className="muted">{i18next.t("goals.byWhen")} <input type="date" style={{ width: "auto" }} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="primary" disabled={!text.trim() || addGoal.isPending} onClick={add}>{i18next.t("goals.addGoal")}</button>
        </div>
      </div>
      {goals.length === 0 && <div className="empty">{i18next.t("goals.noGoalsYetWrite")}</div>}
      {goals.map((g) => <GoalCard key={g.id} goal={g} onDelete={() => remove(g)} />)}
    </>
  );
}

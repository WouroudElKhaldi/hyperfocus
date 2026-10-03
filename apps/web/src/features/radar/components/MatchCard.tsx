import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useToast } from "../../../App.tsx";
import { type Match, useRadarActions } from "../api.ts";

// One match (P6-27): what the job is, why it fits, how long it stays open, and what to do with it. ADHD-first: the
// decision is one click (Save / Not for me / Apply); the full text is behind "Read more". P6-30: saving puts the closing
// day on your calendar with a reminder; "Prepare" makes a task with small steps; "Skills I'm missing" fills your Skills map.

const DAY = 24 * 3600_000;
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY));
const salaryOf = (p: Match["posting"]) =>
  p.salaryMin ? `${p.salaryCurrency} ${p.salaryMin.toLocaleString()}${p.salaryMax ? `–${p.salaryMax.toLocaleString()}` : ""}${p.salaryPeriod ? ` a ${p.salaryPeriod}` : ""}` : "";

export default function MatchCard({ match }: { match: Match }) {
  const toast = useToast();
  const { mark, apply, prepare, gaps } = useRadarActions();
  const [open, setOpen] = useState(false);
  const p = match.posting;
  const left = daysLeft(p.expiresAt);
  const salary = salaryOf(p);
  const busy = mark.isPending || apply.isPending || prepare.isPending || gaps.isPending;

  const read = () => {
    setOpen(!open);
    if (!open && match.status === "new") mark.mutate({ id: match.id, status: "seen" });
  };

  return (
    <article className="card radar-card" aria-labelledby={`job-${match.id}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 id={`job-${match.id}`} style={{ margin: 0 }}>{p.title}</h3>
          <div className="muted">{[p.company, p.locationText, salary].filter(Boolean).join(" · ")}</div>
        </div>
        <span className={`chip ${left <= 3 ? "warn" : ""}`} title="How long the posting stays open">{left === 0 ? "closes today" : `${left} day${left === 1 ? "" : "s"} left`}</span>
      </div>
      <ul className="radar-why" aria-label="Why it fits">
        {match.reasons.map((r) => <li key={r} className="chip">{r}</li>)}
      </ul>
      {open && <p className="radar-text">{p.description || "No description: open the original posting."}</p>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          {match.status === "applied" ? (
            <Link className="btn" to="/jobs">✅ In your Jobs list</Link>
          ) : (
            <button className="primary" disabled={busy} onClick={() => apply.mutate(match.id, { onSuccess: () => toast("Added to your Job applications. Good luck! 🍀") })}>Apply</button>
          )}
          {match.status !== "saved" && match.status !== "applied" && <button disabled={busy} onClick={() => mark.mutate({ id: match.id, status: "saved" }, { onSuccess: () => toast("Saved. The closing day is on your calendar, with a reminder two days before.") })}>Save</button>}
          {match.status !== "applied" && <button className="ghost" disabled={busy} onClick={() => mark.mutate({ id: match.id, status: "dismissed" })}>Not for me</button>}
          {match.taskId ? (
            <Link className="btn ghost" to="/tasks">📋 Your task</Link>
          ) : (
            <button className="ghost" disabled={busy} title="A task with small steps, due two days before it closes" onClick={() => prepare.mutate(match.id, { onSuccess: (r) => toast(r.ai ? "A task with steps is in your Tasks (written by the AI)." : "A task with steps is in your Tasks.") })}>Prepare</button>
          )}
          <button className="ghost" disabled={busy} title="What this job asks for that is not on your Skills map yet" onClick={() => gaps.mutate(match.id, { onSuccess: (r) => toast(r.added.length ? `Added to your Skills map: ${r.added.join(", ")}` : r.have.length ? "You already have every skill it names on your map. 💪" : "This posting names no skills we know.") })}>Skills I'm missing</button>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className="ghost" onClick={read} aria-expanded={open}>{open ? "Less" : "Read more"}</button>
          <a className="btn ghost" href={p.url} target="_blank" rel="noreferrer">Open the posting ↗</a>
          <button className={`ghost ${match.feedback === 1 ? "on" : ""}`} aria-pressed={match.feedback === 1} title="More like this" aria-label="More like this" onClick={() => mark.mutate({ id: match.id, feedback: match.feedback === 1 ? 0 : 1 })}>👍</button>
          <button className={`ghost ${match.feedback === -1 ? "on" : ""}`} aria-pressed={match.feedback === -1} title="Less like this" aria-label="Less like this" onClick={() => mark.mutate({ id: match.id, feedback: match.feedback === -1 ? 0 : -1 })}>👎</button>
        </div>
      </div>
      <small className="muted">via {p.source}</small>
    </article>
  );
}

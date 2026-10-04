import i18next from "i18next";
import { useTranslation } from "react-i18next";
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
  p.salaryMin ? `${p.salaryCurrency} ${p.salaryMin.toLocaleString()}${p.salaryMax ? `–${p.salaryMax.toLocaleString()}` : ""}${p.salaryPeriod === "year" ? i18next.t("radar.pYear") : p.salaryPeriod === "month" ? i18next.t("radar.pMonth") : p.salaryPeriod === "hour" ? i18next.t("radar.pHour") : ""}` : "";

export default function MatchCard({ match }: { match: Match }) {
  useTranslation(); // (re-renders this page when the language changes)
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
        <span className={`chip ${left <= 3 ? "warn" : ""}`} title={i18next.t("radar.howLongThePosting")}>{left === 0 ? i18next.t("radar.closesToday") : left === 1 ? i18next.t("radar.oneDayLeft") : i18next.t("radar.daysLeft", { count: left })}</span>
      </div>
      <ul className="radar-why" aria-label={i18next.t("radar.whyItFits")}>
        {match.reasons.map((r) => <li key={r} className="chip">{r}</li>)}
      </ul>
      {open && <p className="radar-text">{p.description || "No description: open the original posting."}</p>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          {match.status === "applied" ? (
            <Link className="btn" to="/jobs">{i18next.t("radar.inYourJobsList")}</Link>
          ) : (
            <button className="primary" disabled={busy} onClick={() => apply.mutate(match.id, { onSuccess: () => toast(i18next.t("radar.addedToYourJob")) })}>{i18next.t("radar.apply")}</button>
          )}
          {match.status !== "saved" && match.status !== "applied" && <button disabled={busy} onClick={() => mark.mutate({ id: match.id, status: "saved" }, { onSuccess: () => toast(i18next.t("radar.savedTheClosingDay")) })}>{i18next.t("radar.save")}</button>}
          {match.status !== "applied" && <button className="ghost" disabled={busy} onClick={() => mark.mutate({ id: match.id, status: "dismissed" })}>{i18next.t("radar.notForMe")}</button>}
          {match.taskId ? (
            <Link className="btn ghost" to="/tasks">{i18next.t("radar.yourTask")}</Link>
          ) : (
            <button className="ghost" disabled={busy} title={i18next.t("radar.aTaskWithSmall")} onClick={() => prepare.mutate(match.id, { onSuccess: (r) => toast(r.ai ? i18next.t("radar.aTaskWithSteps") : i18next.t("radar.aTaskWithSteps2")) })}>{i18next.t("radar.prepare")}</button>
          )}
          <button className="ghost" disabled={busy} title={i18next.t("radar.whatThisJobAsks")} onClick={() => gaps.mutate(match.id, { onSuccess: (r) => toast(r.added.length ? `Added to your Skills map: ${r.added.join(", ")}` : r.have.length ? i18next.t("radar.youAlreadyHaveEvery") : i18next.t("radar.thisPostingNamesNo")) })}>{i18next.t("radar.skillsIMMissing")}</button>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className="ghost" onClick={read} aria-expanded={open}>{open ? i18next.t("radar.less") : i18next.t("radar.readMore")}</button>
          <a className="btn ghost" href={p.url} target="_blank" rel="noreferrer">{i18next.t("radar.openThePosting")}</a>
          <button className={`ghost ${match.feedback === 1 ? "on" : ""}`} aria-pressed={match.feedback === 1} title={i18next.t("radar.moreLikeThis")} aria-label={i18next.t("radar.moreLikeThis")} onClick={() => mark.mutate({ id: match.id, feedback: match.feedback === 1 ? 0 : 1 })}>👍</button>
          <button className={`ghost ${match.feedback === -1 ? "on" : ""}`} aria-pressed={match.feedback === -1} title={i18next.t("radar.lessLikeThis")} aria-label={i18next.t("radar.lessLikeThis")} onClick={() => mark.mutate({ id: match.id, feedback: match.feedback === -1 ? 0 : -1 })}>👎</button>
        </div>
      </div>
      <small className="muted">via {p.source}</small>
    </article>
  );
}

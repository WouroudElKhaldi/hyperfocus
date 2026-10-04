import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { type SyntheticEvent, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Job } from "../../../types.ts";
import { useAddJob, useJobs, useUpdateJob } from "../api.ts";

export const STATUS: Record<string, string> = { wishlist: i18next.t("jobs.wishlist"), applied: i18next.t("jobs.applied"), interview: i18next.t("jobs.interview"), offer: i18next.t("jobs.offer"), rejected: i18next.t("jobs.rejected"), withdrawn: i18next.t("jobs.withdrawn") };
export const statusChip = (s: string) => "chip " + (s === "applied" || s === "offer" ? "posted" : s === "interview" ? "scheduled" : s === "rejected" ? "failed" : "");
export const dayOf = (d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

const TABS: [string, string][] = [["all", "All"], ...Object.entries(STATUS)];

export default function Jobs() {
  useTranslation(); // (re-renders this page when the language changes)
  const nav = useNavigate();
  const jobs = useJobs().data ?? [];
  const addJob = useAddJob();
  const update = useUpdateJob();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ company: "", title: "", url: "" });
  const [adding, setAdding] = useState(false);

  const add = () => addJob.mutate(form, { onSuccess: (j) => nav({ to: "/jobs/$id", params: { id: String(j.id) } }) });
  const setStatus = (e: SyntheticEvent, j: Job, status: string) => {
    e.preventDefault(); e.stopPropagation();
    update.mutate({ id: j.id, change: { status } });
  };

  const needle = q.trim().toLowerCase();
  const shown = jobs.filter((j) => (tab === "all" || j.status === tab) && (!needle || `${j.company} ${j.title} ${j.location} ${j.notes}`.toLowerCase().includes(needle)));
  const count = (k: string) => jobs.filter((j) => k === "all" || j.status === k).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{i18next.t("jobs.jobApplications")}</h1>
          <p className="sub">{i18next.t("jobs.everyJobYouRe")}</p>
        </div>
        <button className="primary big" onClick={() => setAdding((a) => !a)}>{adding ? i18next.t("jobs.close") : "+ New job"}</button>
      </div>

      {adding && (
        <div className="card">
          <div className="job-form">
            <input placeholder={i18next.t("jobs.company2")} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus />
            <input placeholder={i18next.t("jobs.jobTitle")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder={i18next.t("jobs.linkToTheJob")} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div className="row" style={{ marginTop: "var(--s-3)" }}>
            <button className="primary" disabled={!form.company.trim()} onClick={add}>{i18next.t("jobs.addJob")}</button>
            <span className="muted">{i18next.t("jobs.youCanFillIn")}</span>
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-4)" }}>
        <div className="tabs" style={{ margin: 0 }}>
          {TABS.map(([k, label]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label} ({count(k)})</button>)}
        </div>
        <input type="search" placeholder={i18next.t("jobs.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={i18next.t("jobs.searchJobs")} style={{ maxWidth: 240 }} />
      </div>

      {shown.length === 0 && <div className="empty">{jobs.length ? i18next.t("jobs.nothingInThisFilter") : i18next.t("jobs.noJobsYetPress")}</div>}
      {shown.map((j) => (
        <Link to="/jobs/$id" params={{ id: String(j.id) }} className="card email-row" key={j.id}>
          <div className="email-main">
            <div className="row" style={{ gap: "var(--s-2)" }}>
              <b>{j.title || "(no title)"}</b><span className="muted">at {j.company}</span>
            </div>
            <div className="muted">
              {j.appliedAt ? `Applied ${dayOf(j.appliedAt)}` : i18next.t("jobs.notAppliedYet")}
              {j.location && ` · ${j.location}`}
              {j.emailCount > 1 ? i18next.t("jobs.emails", { count: j.emailCount }) : j.emailCount === 1 ? i18next.t("jobs.oneEmail") : j.status !== "wishlist" ? i18next.t("jobs.noEmail") : ""}
              {j.followUpDay && ` · follow up ${j.followUpDay}`}{j.followUpDay && j.followUpDay <= today && !["rejected", "withdrawn", "offer"].includes(j.status) && " ⏰"}
            </div>
          </div>
          <div className="row">
            <select className={statusChip(j.status)} value={j.status} aria-label={i18next.t("jobs.status")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} onChange={(e) => setStatus(e, j, e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </Link>
      ))}
    </>
  );
}

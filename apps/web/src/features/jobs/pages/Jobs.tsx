import { type SyntheticEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { api, errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import type { Job, JobListItem } from "../../../types.ts";

export const STATUS: Record<string, string> = { wishlist: "⭐ Wishlist", applied: "✓ Applied", interview: "🗣 Interview", offer: "🎉 Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
export const statusChip = (s: string) => "chip " + (s === "applied" || s === "offer" ? "posted" : s === "interview" ? "scheduled" : s === "rejected" ? "failed" : "");
export const dayOf = (d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

const TABS: [string, string][] = [["all", "All"], ...Object.entries(STATUS)];

export default function Jobs() {
  const toast = useToast();
  const nav = useNavigate();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ company: "", title: "", url: "" });
  const [adding, setAdding] = useState(false);

  const load = () => api.get("/jobs").then(setJobs).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      const j = await api.post("/jobs", form);
      nav({ to: "/jobs/$id", params: { id: String(j.id) } });
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const setStatus = async (e: SyntheticEvent, j: Job, status: string) => {
    e.preventDefault(); e.stopPropagation();
    try { await api.patch(`/jobs/${j.id}`, { status }); load(); } catch (caught) { const x = errorOf(caught); toast(x.message, "err"); }
  };

  const needle = q.trim().toLowerCase();
  const shown = jobs.filter((j) => (tab === "all" || j.status === tab) && (!needle || `${j.company} ${j.title} ${j.location} ${j.notes}`.toLowerCase().includes(needle)));
  const count = (k: string) => jobs.filter((j) => k === "all" || j.status === k).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Job applications</h1>
          <p className="sub">Every job you're chasing, and the email that proves you applied.</p>
        </div>
        <button className="primary big" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "+ New job"}</button>
      </div>

      {adding && (
        <div className="card">
          <div className="job-form">
            <input placeholder="Company *" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus />
            <input placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder="Link to the job post" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div className="row" style={{ marginTop: "var(--s-3)" }}>
            <button className="primary" disabled={!form.company.trim()} onClick={add}>Add job</button>
            <span className="muted">You can fill in the rest on the next screen.</span>
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-4)" }}>
        <div className="tabs" style={{ margin: 0 }}>
          {TABS.map(([k, label]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label} ({count(k)})</button>)}
        </div>
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" style={{ maxWidth: 240 }} />
      </div>

      {shown.length === 0 && <div className="empty">{jobs.length ? "Nothing in this filter." : "No jobs yet. Press “New job” when you find one."}</div>}
      {shown.map((j) => (
        <Link to="/jobs/$id" params={{ id: String(j.id) }} className="card email-row" key={j.id}>
          <div className="email-main">
            <div className="row" style={{ gap: "var(--s-2)" }}>
              <b>{j.title || "(no title)"}</b><span className="muted">at {j.company}</span>
            </div>
            <div className="muted">
              {j.appliedAt ? `Applied ${dayOf(j.appliedAt)}` : "Not applied yet"}
              {j.location && ` · ${j.location}`}
              {j.emailCount > 0 ? ` · ✉️ ${j.emailCount} email${j.emailCount > 1 ? "s" : ""}` : j.status !== "wishlist" ? " · no email linked" : ""}
              {j.followUpDay && ` · follow up ${j.followUpDay}`}{j.followUpDay && j.followUpDay <= today && !["rejected", "withdrawn", "offer"].includes(j.status) && " ⏰"}
            </div>
          </div>
          <div className="row">
            <select className={statusChip(j.status)} value={j.status} aria-label="Status" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} onChange={(e) => setStatus(e, j, e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </Link>
      ))}
    </>
  );
}

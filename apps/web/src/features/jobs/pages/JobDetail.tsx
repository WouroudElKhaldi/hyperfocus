import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { type ChangeEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { errorOf } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { useDeleteJob, useJob, useLinkEmail, useUpdateJob, useWriteJobEmail } from "../api.ts";
import { useToast } from "../../../App.tsx";
import { STATUS, dayOf, statusChip } from "./Jobs.tsx";
import LoadProblem, { isId, notFound } from "../../../components/LoadProblem.tsx";
import type { Job } from "../../../types.ts";

const when = (d: string | null) => new Date(d ?? 0).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const EDIT = ["company", "title", "url", "location", "salary", "source", "contactName", "contactEmail", "followUpDay", "notes"] as const;
type Form = Record<(typeof EDIT)[number], string>;
const formOf = (j: Job) => Object.fromEntries(EDIT.map((k) => [k, j[k] ?? ""] as const)) as Form;

export default function JobDetail() {
  useTranslation(); // (re-renders this page when the language changes)
  const { id } = useParams({ from: "/jobs/$id" });
  const nav = useNavigate();
  const toast = useToast();
  const jobQuery = useJob(id);
  const job = jobQuery.data ?? null;
  const loadErr = !isId(id) ? notFound : jobQuery.error ? errorOf(jobQuery.error) : null;
  const emails = useApi("/emails").data ?? []; // every email, to pick one to link
  const update = useUpdateJob();
  const linkEmail = useLinkEmail();
  const writeEmail = useWriteJobEmail();
  const deleteJob = useDeleteJob();
  const [f, setF] = useState<Form | null>(null);
  const [pick, setPick] = useState("");

  // the form is filled once when the job loads, and again from what the server saved
  useEffect(() => { if (job) setF(formOf(job)); }, [job?.id]);

  const dirty = job && f && EDIT.some((k) => (f[k] ?? "") !== (job[k] ?? ""));
  const save = () => {
    if (f) update.mutate({ id: Number(id), change: f }, { onSuccess: (j) => { setF(formOf(j)); toast(i18next.t("jobs.saved")); } });
  };
  const patch = (change: Parameters<typeof update.mutate>[0]["change"]) => update.mutate({ id: Number(id), change });
  const link = (emailId: number | string, jobId: number | null) => linkEmail.mutate({ emailId, jobId }, { onSuccess: () => setPick("") });
  const write = () => writeEmail.mutate(Number(id), { onSuccess: (m) => nav({ to: "/emails/$id", params: { id: String(m.id) } }) });
  const remove = () => {
    if (confirm(i18next.t("jobs.deleteThisJobYour"))) deleteJob.mutate(Number(id), { onSuccess: () => nav({ to: "/jobs" }) });
  };

  if (loadErr) return <LoadProblem error={loadErr} what="job" back="/jobs" backLabel={i18next.t("jobs.backToJobs")} onRetry={() => jobQuery.refetch()} />;
  if (!job || !f) return <p className="muted">{i18next.t("jobs.loading")}</p>;
  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => (x ? { ...x, [k]: e.target.value } : x));
  const linkedIds = new Set(job.emails.map((m) => m.id));
  const candidates = emails.filter((m) => !linkedIds.has(m.id)).sort((a, b) => Number(b.status === "sent") - Number(a.status === "sent"));
  const sent = job.emails.filter((m) => m.status === "sent");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{job.title || "Job"} <span className="muted">at {job.company}</span></h1>
          <p className="sub">
            <Link to="/jobs">{i18next.t("jobs.allJobs")}</Link>{" · "}
            <span className={statusChip(job.status)}>{STATUS[job.status]}</span>{" "}
            {job.appliedAt ? `Applied ${dayOf(job.appliedAt)}` : i18next.t("jobs.notAppliedYet")}
          </p>
        </div>
        <div className="row">
          {job.url && <a className="btn" href={job.url} target="_blank" rel="noopener noreferrer">{i18next.t("jobs.openJobPost")}</a>}
          <button className="ghost danger" onClick={remove}>{i18next.t("jobs.delete")}</button>
        </div>
      </div>

      <div className="card">
        <h2>{i18next.t("jobs.didIApply")}</h2>
        {sent.length > 0
          ? <p><b>{i18next.t("jobs.yes")}</b> You sent {sent.length === 1 ? "an email" : `${sent.length} emails`} for this job, the latest on {when(sent[0]?.sentAt ?? null)}.</p>
          : <p className="muted">{i18next.t("jobs.noSentEmailIs")}</p>}
        <div className="job-emails">
          {job.emails.map((m) => (
            <div className="job-email" key={m.id}>
              <Link to="/emails/$id" params={{ id: String(m.id) }}><b>{m.subject || "(no subject)"}</b></Link>
              <span className="muted">To: {m.toAddr || "—"}</span>
              <span className={"chip " + (m.status === "sent" ? "posted" : m.status === "failed" ? "failed" : "")}>{m.status === "sent" ? `✓ Sent ${when(m.sentAt)}` : m.status === "failed" ? i18next.t("jobs.notSent") : i18next.t("jobs.draft")}</span>
              <button className="ghost" onClick={() => link(m.id, null)} aria-label={i18next.t("jobs.unlinkThisEmail")}>{i18next.t("jobs.unlink")}</button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: "var(--s-3)", flexWrap: "wrap" }}>
          <button className="primary" onClick={write}>{i18next.t("jobs.writeAnEmailFor")}</button>
          {candidates.length > 0 && (
            <>
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={i18next.t("jobs.pickAnEmailTo")} style={{ maxWidth: 360 }}>
                <option value="">{i18next.t("jobs.linkAnExistingEmail")}</option>
                {candidates.map((m) => <option key={m.id} value={m.id}>{m.status === "sent" ? "✓ " : ""}{m.subject || "(no subject)"} — {m.toAddr || "no recipient"}{m.job ? ` (linked to ${m.job.company})` : ""}</option>)}
              </select>
              <button disabled={!pick} onClick={() => link(pick, job.id)}>{i18next.t("jobs.link")}</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h2>{i18next.t("jobs.details")}</h2>
        <div className="job-form">
          <label>{i18next.t("jobs.company")}<input value={f.company} onChange={set("company")} /></label>
          <label>{i18next.t("jobs.jobTitle")}<input value={f.title} onChange={set("title")} /></label>
          <label>{i18next.t("jobs.status")}
            <select value={job.status} onChange={(e) => patch({ status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>{i18next.t("jobs.linkToTheJob")}<input value={f.url} onChange={set("url")} placeholder={i18next.t("jobs.https")} /></label>
          <label>{i18next.t("jobs.location")}<input value={f.location} onChange={set("location")} placeholder={i18next.t("jobs.remoteBeirut")} /></label>
          <label>{i18next.t("jobs.salary")}<input value={f.salary} onChange={set("salary")} /></label>
          <label>{i18next.t("jobs.whereYouFoundIt")}<input value={f.source} onChange={set("source")} placeholder={i18next.t("jobs.linkedinAFriend")} /></label>
          <label>{i18next.t("jobs.contactName")}<input value={f.contactName} onChange={set("contactName")} /></label>
          <label>{i18next.t("jobs.contactEmail")}<input value={f.contactEmail} onChange={set("contactEmail")} /></label>
          <label>{i18next.t("jobs.followUpOn")}<input type="date" value={f.followUpDay} onChange={set("followUpDay")} /></label>
        </div>
        <label className="job-notes">{i18next.t("jobs.notes")}<textarea value={f.notes} onChange={set("notes")} placeholder={i18next.t("jobs.whatTheyAskedFor")} /></label>
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <button className="primary" disabled={!dirty || !f.company.trim()} onClick={save}>{i18next.t("jobs.saveChanges")}</button>
          {dirty && <span className="muted">{i18next.t("jobs.unsavedChanges")}</span>}
        </div>
      </div>
    </>
  );
}

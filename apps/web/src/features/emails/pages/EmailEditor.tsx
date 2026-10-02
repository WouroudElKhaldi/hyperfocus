import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { type ApiError, api, errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import RichEditor, { type RichEditorHandle } from "../components/RichEditor.tsx";
import type { Attachment, Email, JobListItem, MailStatus } from "../../../types.ts";
import LoadProblem, { isId, notFound } from "../../../components/LoadProblem.tsx";

const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (d: string) => new Date(d).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const FILE = (a: Attachment) => `/api/emails/attachments/${a.id}`;

type Draft = { toAddr: string; ccAddr: string; bccAddr: string; subject: string };

async function uploadFile(emailId: string | undefined, file: File, inline: boolean): Promise<Attachment> {
  let res: Response;
  try {
    res = await fetch(`/api/emails/${emailId}/attachments?name=${encodeURIComponent(file.name || "image.png")}${inline ? "&inline=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-File-Type": file.type || "application/octet-stream" },
      body: file,
    });
  } catch { throw new Error("Can't reach the server. Is `npm run dev` running?"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (res.status === 413 ? "That file is too big (20 MB max)." : `Upload failed (${res.status})`));
  return data;
}

export default function EmailEditor() {
  const { id } = useParams({ from: "/emails/$id" });
  const nav = useNavigate();
  const toast = useToast();
  const editor = useRef<RichEditorHandle>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [email, setEmail] = useState<Email | null>(null);
  const [f, setF] = useState<Draft>({ toAddr: "", ccAddr: "", bccAddr: "", subject: "" });
  const [html, setHtml] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState("");
  const [fixes, setFixes] = useState<string[]>([]);
  const [history, setHistory] = useState<(Draft & { html: string })[]>([]); // the text before each "fix my English", so it can be undone
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"

  useEffect(() => {
    loaded.current = false;
    setEmail(null); setHistory([]); setFixes([]); setLoadErr(null);
    if (!isId(id)) { setLoadErr(notFound); return; }
    api.get(`/emails/${id}`).then((e) => {
      setEmail(e); setHtml(e.html); setFiles(e.attachments);
      setF({ toAddr: e.toAddr, ccAddr: e.ccAddr, bccAddr: e.bccAddr, subject: e.subject });
      setShowCc(!!(e.ccAddr || e.bccAddr));
      setSaved(true);
      // the first edit event after loading is not a change
      setTimeout(() => { loaded.current = true; }, 0);
    }).catch(setLoadErr);
    api.get("/emails/status").then(setStatus).catch(() => {});
    api.get("/jobs").then(setJobs).catch(() => {});
  }, [id, attempt]);

  const locked = !!email && (email.status === "sent" || email.status === "sending");
  const current = () => ({ ...f, html: editor.current?.getHtml() ?? html });

  // saves a moment after you stop typing
  useEffect(() => {
    if (!loaded.current || locked) return;
    setSaved(false);
    timer.current = setTimeout(() => api.put(`/emails/${id}`, current()).then(() => setSaved(true)).catch((e) => toast(e.message, "err")), 800);
    return () => clearTimeout(timer.current);
  }, [f, html]);

  const addFiles = async (list: File[]) => {
    setBusy("upload");
    for (const file of list) {
      try { const a = await uploadFile(id, file, false); setFiles((x) => [...x, a]); }
      catch (caught) { const e = errorOf(caught); toast(`${file.name}: ${e.message}`, "err"); }
    }
    setBusy("");
  };
  const onImage = async (file: File) => {
    const a = await uploadFile(id, file, true);
    setFiles((x) => [...x, a]);
    return FILE(a);
  };
  const removeFile = async (a: Attachment) => {
    try { await api.del(`/emails/attachments/${a.id}`); setFiles((x) => x.filter((y) => y.id !== a.id)); } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };

  const polish = async () => {
    setBusy("polish");
    try {
      const before = current();
      const out = await api.post("/ai/polish-email", { subject: before.subject, html: before.html });
      if (out.html === before.html && out.subject === before.subject) toast("Already clean, nothing to fix ✨");
      else {
        setHistory((h) => [...h, before]);
        editor.current?.setHtml(out.html);
        setF((x) => ({ ...x, subject: out.subject }));
      }
      setFixes(out.changes);
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy("");
  };
  const undoPolish = () => {
    const last = history.at(-1);
    if (!last) return;
    editor.current?.setHtml(last.html);
    setF((x) => ({ ...x, subject: last.subject }));
    setHistory((h) => h.slice(0, -1));
    setFixes([]);
  };

  const saveTemplate = async () => {
    const name = window.prompt("Template name", f.subject || "");
    if (name === null) return;
    try {
      await api.post(`/emails/${id}/save-template`, { name: name || f.subject || "Untitled template", subject: f.subject, html: current().html });
      toast("Saved as a template 📌");
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };

  const send = async () => {
    const d = current();
    if (!d.toAddr.trim()) return toast("Add who it's for in “To”.", "err");
    if (!d.subject.trim() && !confirm("This email has no subject. Send it anyway?")) return;
    if (!confirm(`Send this email to ${d.toAddr.trim()}${d.ccAddr.trim() ? ` (cc ${d.ccAddr.trim()})` : ""}?`)) return;
    setBusy("send");
    clearTimeout(timer.current);
    try {
      const out = await api.post(`/emails/${id}/send`, d);
      loaded.current = false;
      setEmail({ ...out.email, attachments: files });
      toast("Sent ✉️");
    } catch (caught) { const e = errorOf(caught);
      toast(e.message, "err");
      api.get(`/emails/${id}`).then(setEmail).catch(() => {});
    }
    setBusy("");
  };

  // linking works even after sending, that is how a sent email proves an application
  const setJob = async (jobId: string) => {
    try {
      const out = await api.put(`/emails/${id}/job`, { jobId });
      setEmail((m) => (m ? { ...m, jobId: out.jobId } : m));
      api.get("/jobs").then(setJobs);
      toast(out.jobId ? "Linked to the job 💼" : "Unlinked from the job");
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };

  const remove = async () => {
    if (!confirm("Delete this email for good?")) return;
    clearTimeout(timer.current);
    loaded.current = false;
    await api.del(`/emails/${id}`);
    nav({ to: "/emails" });
  };
  const duplicate = async () => { const c = await api.post(`/emails/${id}/duplicate`); nav({ to: "/emails/$id", params: { id: String(c.id) } }); };

  if (loadErr) return <LoadProblem error={loadErr} what="email" back="/emails" backLabel="Back to email" onRetry={() => setAttempt((a) => a + 1)} />;
  if (!email) return <p className="muted">Loading…</p>;
  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const attached = files.filter((a) => !a.inline);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{locked ? "Sent email" : "Write an email"}</h1>
          <p className="sub">
            <Link to="/emails">← All emails</Link>{" · "}
            {locked
              ? <span className="chip posted">✓ Sent {email.sentAt && when(email.sentAt)}{email.fromAddr && ` from ${email.fromAddr}`}</span>
              : <><span className={"chip " + (email.status === "failed" ? "failed" : "")}>{email.status === "failed" ? "⚠️ Not sent" : "Draft"}</span> {saved ? "Saved" : "Saving…"}</>}
          </p>
        </div>
        <div className="row">
          {locked && <button className="primary" onClick={duplicate}>Duplicate as new draft</button>}
          <button className="ghost danger" onClick={remove}>Delete</button>
        </div>
      </div>

      {!locked && status && !status.ready && (
        <div className="card warn-card" role="note">
          <b>Gmail isn't connected yet.</b> You can write and save drafts, but sending needs{!status.hasUser && <> <code>GMAIL_USER</code> (your Gmail address)</>}{!status.hasUser && !status.hasKey && " and"}{!status.hasKey && <> <code>GMAIL_APP_KEY</code> (an app password)</>} in the <code>.env</code> file at the project root. Restart the app after adding {status.hasUser || status.hasKey ? "it" : "them"}.
        </div>
      )}
      {email.status === "failed" && email.lastError && <div className="card warn-card" role="alert"><b>Last attempt failed:</b> {email.lastError}</div>}

      <div className="card email-card">
        <div className="email-fields">
          <label>To<input value={f.toAddr} onChange={set("toAddr")} disabled={locked} placeholder="name@example.com, another@example.com" /></label>
          {!showCc && !locked && <button type="button" className="ghost" onClick={() => setShowCc(true)}>+ Cc / Bcc</button>}
          {(showCc || (locked && (f.ccAddr || f.bccAddr))) && (
            <>
              <label>Cc<input value={f.ccAddr} onChange={set("ccAddr")} disabled={locked} /></label>
              <label>Bcc<input value={f.bccAddr} onChange={set("bccAddr")} disabled={locked} /></label>
            </>
          )}
          <label>Job
            <span className="row" style={{ gap: "var(--s-2)" }}>
              <select value={email.jobId ?? ""} onChange={(e) => setJob(e.target.value)} aria-label="Linked job" style={{ maxWidth: 420 }}>
                <option value="">Not linked to a job</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title || "(no title)"} at {j.company}</option>)}
              </select>
              {email.jobId && <Link to="/jobs/$id" params={{ id: String(email.jobId) }}>Open job →</Link>}
            </span>
          </label>
          <label>Subject<input value={f.subject} onChange={set("subject")} disabled={locked} placeholder="What is it about?" /></label>
        </div>

        {locked
          ? // biome-ignore lint/security/noDangerouslySetInnerHtml: email HTML is sanitised by the API (cleanHtml in mail.ts) on every save
            <div className="email-read" dangerouslySetInnerHTML={{ __html: email.html }} />
          : <RichEditor key={id} ref={editor} html={email.html} onChange={setHtml} onImage={onImage} onError={(m) => toast(m, "err")} />}

        {(attached.length > 0 || !locked) && (
          <div className="email-files">
            {attached.map((a) => (
              <span className="file-chip" key={a.id}>
                <a href={FILE(a)} download={a.filename}>📎 {a.filename}</a> <span className="muted">{size(a.size)}</span>
                {!locked && <button type="button" className="ghost" aria-label={`Remove ${a.filename}`} onClick={() => removeFile(a)}>✕</button>}
              </span>
            ))}
            {!locked && <label className="btn ghost attach">{busy === "upload" ? "Uploading…" : "📎 Attach files"}<input type="file" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} /></label>}
          </div>
        )}

        {!locked && (
          <>
            <div className="row email-actions">
              <button className="primary big" disabled={!!busy} onClick={send}>{busy === "send" ? "Sending…" : "✉️ Send"}</button>
              <button disabled={!!busy} onClick={polish} title="Fixes spelling, grammar and awkward sentences. Keeps your words, order and formatting.">{busy === "polish" ? "Working…" : "🪶 Fix my English"}</button>
              <button className="ghost" disabled={!history.length} onClick={undoPolish}>↶ Undo fix</button>
              <span className="tabs-gap" />
              <button className="ghost" disabled={!!busy} onClick={saveTemplate}>📌 Save as template</button>
            </div>
            {fixes.length > 0 && <div className="hookbox"><b>Fixed:</b> {fixes.join(" · ")}</div>}
          </>
        )}
      </div>
    </>
  );
}

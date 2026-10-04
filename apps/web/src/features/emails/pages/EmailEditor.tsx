import { type ChangeEvent, useEffect, useRef, useState } from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { api, errorOf } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { useDeleteEmail, useEmail, useEmailChanges, useMailStatus } from "../api.ts";
import { useToast } from "../../../App.tsx";
import RichEditor, { type RichEditorHandle } from "../components/RichEditor.tsx";
import type { Attachment } from "../../../types.ts";
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
  } catch { throw new Error(i18next.t("email.uploadServer")); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || (res.status === 413 ? i18next.t("email.tooBig") : i18next.t("email.uploadFailed", { status: res.status })));
  return data;
}

export default function EmailEditor() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/emails/$id" });
  const nav = useNavigate();
  const toast = useToast();
  const editor = useRef<RichEditorHandle>(null);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [f, setF] = useState<Draft>({ toAddr: "", ccAddr: "", bccAddr: "", subject: "" });
  const [html, setHtml] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState("");
  const [fixes, setFixes] = useState<string[]>([]);
  const [history, setHistory] = useState<(Draft & { html: string })[]>([]); // the text before each "fix my English", so it can be undone
  const emailQuery = useEmail(id);
  const email = emailQuery.data ?? null;
  const loadErr = !isId(id) ? notFound : emailQuery.error ? errorOf(emailQuery.error) : null;
  const status = useMailStatus().data ?? null;
  const jobs = useApi("/jobs").data ?? [];
  const change = useEmailChanges(id);
  const deleteEmail = useDeleteEmail();

  // the fields are filled in once, when the email first loads (after that they are yours, and autosave)
  useEffect(() => {
    loaded.current = false;
    setHistory([]); setFixes([]);
    if (!email) return;
    setHtml(email.html); setFiles(email.attachments);
    setF({ toAddr: email.toAddr, ccAddr: email.ccAddr, bccAddr: email.bccAddr, subject: email.subject });
    setShowCc(!!(email.ccAddr || email.bccAddr));
    setSaved(true);
    // the first edit event after loading is not a change
    setTimeout(() => { loaded.current = true; }, 0);
  }, [email?.id]);

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
      if (out.html === before.html && out.subject === before.subject) toast(t("email.alreadyClean"));
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

  const saveTemplate = () => {
    const name = window.prompt(t("email.templateName"), f.subject || "");
    if (name === null) return;
    change.saveTemplate.mutate({ name: name || f.subject || t("email.untitledTemplate"), subject: f.subject, html: current().html }, { onSuccess: () => toast(t("email.savedTemplate")) });
  };

  const send = () => {
    const d = current();
    if (!d.toAddr.trim()) return toast(t("email.needTo"), "err");
    if (!d.subject.trim() && !confirm(t("email.noSubjectAsk"))) return;
    if (!confirm(d.ccAddr.trim() ? t("email.sendAskCc", { to: d.toAddr.trim(), cc: d.ccAddr.trim() }) : t("email.sendAsk", { to: d.toAddr.trim() }))) return;
    setBusy("send");
    clearTimeout(timer.current);
    change.send.mutate(d, {
      onSuccess: () => { loaded.current = false; toast(t("email.sentToast")); },
      onError: (caught) => toast(errorOf(caught).message, "err"),
      onSettled: () => setBusy(""),
    });
  };

  // linking works even after sending, that is how a sent email proves an application
  const setJob = (jobId: string) => change.linkJob.mutate(jobId, { onSuccess: (out) => toast(out.jobId ? t("email.linkedToast") : t("email.unlinkedToast")) });

  const remove = () => {
    if (!confirm(t("email.deleteForGood"))) return;
    clearTimeout(timer.current);
    loaded.current = false;
    deleteEmail.mutate(Number(id), { onSuccess: () => nav({ to: "/emails" }) });
  };
  const duplicate = () => change.duplicate.mutate(undefined, { onSuccess: (c) => nav({ to: "/emails/$id", params: { id: String(c.id) } }) });

  if (loadErr) return <LoadProblem error={loadErr} what="email" back="/emails" backLabel={t("email.backToEmail")} onRetry={() => emailQuery.refetch()} />;
  if (!email) return <p className="muted">{t("email.loading")}</p>;
  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const attached = files.filter((a) => !a.inline);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{locked ? t("email.sentEmail") : t("email.write")}</h1>
          <p className="sub">
            <Link to="/emails">{t("email.allEmails")}</Link>{" · "}
            {locked
              ? <span className="chip posted">{t("email.sentOn", { when: email.sentAt ? when(email.sentAt) : "" })}{email.fromAddr && t("email.fromAddr", { from: email.fromAddr })}</span>
              : <><span className={"chip " + (email.status === "failed" ? "failed" : "")}>{email.status === "failed" ? t("email.sFailed") : t("email.sDraft")}</span> {saved ? t("email.saved") : t("email.saving")}</>}
          </p>
        </div>
        <div className="row">
          {locked && <button className="primary" onClick={duplicate}>{t("email.duplicate")}</button>}
          <button className="ghost danger" onClick={remove}>{t("email.delete")}</button>
        </div>
      </div>

      {!locked && status && !status.ready && (
        <div className="card warn-card" role="note">
          <b>{t("email.gmailOff")}</b> {t("email.gmailOffNote")} <Link to="/backup">{t("email.connections")}</Link>.
        </div>
      )}
      {email.status === "failed" && email.lastError && <div className="card warn-card" role="alert"><b>{t("email.lastFailed")}</b> {email.lastError}</div>}

      <div className="card email-card">
        <div className="email-fields">
          <label>{t("email.toLabel")}<input value={f.toAddr} onChange={set("toAddr")} disabled={locked} placeholder="name@example.com, another@example.com" /></label>
          {!showCc && !locked && <button type="button" className="ghost" onClick={() => setShowCc(true)}>{t("email.ccBcc")}</button>}
          {(showCc || (locked && (f.ccAddr || f.bccAddr))) && (
            <>
              <label>Cc<input value={f.ccAddr} onChange={set("ccAddr")} disabled={locked} /></label>
              <label>Bcc<input value={f.bccAddr} onChange={set("bccAddr")} disabled={locked} /></label>
            </>
          )}
          <label>{t("email.job")}
            <span className="row" style={{ gap: "var(--s-2)" }}>
              <select value={email.jobId ?? ""} onChange={(e) => setJob(e.target.value)} aria-label={t("email.linkedJob")} style={{ maxWidth: 420 }}>
                <option value="">{t("email.notLinked")}</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{t("email.jobAt", { title: j.title || t("email.noTitle"), company: j.company })}</option>)}
              </select>
              {email.jobId && <Link to="/jobs/$id" params={{ id: String(email.jobId) }}>{t("email.openJob")}</Link>}
            </span>
          </label>
          <label>{t("email.subject")}<input value={f.subject} onChange={set("subject")} disabled={locked} placeholder={t("email.subjectPlaceholder")} /></label>
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
                {!locked && <button type="button" className="ghost" aria-label={t("email.remove", { name: a.filename })} onClick={() => removeFile(a)}>✕</button>}
              </span>
            ))}
            {!locked && <label className="btn ghost attach">{busy === "upload" ? t("email.uploading") : t("email.attach")}<input type="file" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} /></label>}
          </div>
        )}

        {!locked && (
          <>
            <div className="row email-actions">
              <button className="primary big" disabled={!!busy} onClick={send}>{busy === "send" ? t("email.sending") : t("email.send")}</button>
              <button disabled={!!busy} onClick={polish} title={t("email.fixHint")}>{busy === "polish" ? t("email.working") : t("email.fix")}</button>
              <button className="ghost" disabled={!history.length} onClick={undoPolish}>{t("email.undoFix")}</button>
              <span className="tabs-gap" />
              <button className="ghost" disabled={!!busy} onClick={saveTemplate}>{t("email.saveTemplate")}</button>
            </div>
            {fixes.length > 0 && <div className="hookbox"><b>{t("email.fixed")}</b> {fixes.join(" · ")}</div>}
          </>
        )}
      </div>
    </>
  );
}

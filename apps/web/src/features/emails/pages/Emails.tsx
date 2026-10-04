import { type MouseEvent, useState } from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import type { EmailListItem, EmailTemplate } from "../../../types.ts";
import { useDeleteEmail, useDeleteTemplate, useEmails, useNewEmail, useRenameTemplate, useTemplates } from "../api.ts";

const TABS: [string, "all" | "drafts" | "sent" | "failed" | "templates"][] = [["all", "all"], ["draft", "drafts"], ["sent", "sent"], ["failed", "failed"], ["templates", "templates"]];
const day = (d: string) => new Date(d).toLocaleString(i18next.language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, "sDraft" | "sSent" | "sFailed" | "sSending"> = { draft: "sDraft", sent: "sSent", failed: "sFailed", sending: "sSending" };

export default function Emails() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const emails = useEmails().data ?? [];
  const templates = useTemplates().data ?? [];
  const newEmail = useNewEmail();
  const deleteEmail = useDeleteEmail();
  const renameTemplate = useRenameTemplate();
  const deleteTemplate = useDeleteTemplate();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const open = (m: { id: number }) => nav({ to: "/emails/$id", params: { id: String(m.id) } });
  const create = () => newEmail.mutate(undefined, { onSuccess: open });
  const applyTemplate = (tp: EmailTemplate) => newEmail.mutate(tp.id, { onSuccess: open });
  const rename = (tp: EmailTemplate) => {
    const name = window.prompt(t("email.templateName"), tp.name);
    if (name?.trim()) renameTemplate.mutate({ id: tp.id, name });
  };
  const removeTemplate = (tp: EmailTemplate) => { if (confirm(t("email.deleteTemplate", { name: tp.name }))) deleteTemplate.mutate(tp.id); };
  const remove = (e: MouseEvent, m: EmailListItem) => {
    e.preventDefault(); e.stopPropagation();
    if (confirm(m.status === "sent" ? t("email.deleteSent") : t("email.deleteAsk"))) deleteEmail.mutate(m.id);
  };

  const needle = q.trim().toLowerCase();
  const shown = emails.filter((m) => (tab === "all" || m.status === tab) && (!needle || `${m.toAddr} ${m.ccAddr} ${m.subject} ${m.preview}`.toLowerCase().includes(needle)));
  const count = (k: string) => (k === "templates" ? templates.length : emails.filter((m) => k === "all" || m.status === k).length);
  const shownTemplates = templates.filter((tp) => !needle || `${tp.name} ${tp.subject} ${tp.preview}`.toLowerCase().includes(needle));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("email.title")}</h1>
          <p className="sub">{t("email.sub")}</p>
        </div>
        <button className="primary big" onClick={create}>{t("email.new")}</button>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-4)" }}>
        <div className="tabs" style={{ margin: 0 }}>
          {TABS.map(([k, label]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t(`email.${label}`)} ({count(k)})</button>)}
        </div>
        <input type="search" placeholder={t("email.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("email.searchLabel")} style={{ maxWidth: 240 }} />
      </div>

      {tab === "templates" ? (
        <>
          {shownTemplates.length === 0 && <div className="empty">{templates.length ? t("email.noTemplateMatch") : t("email.noTemplates")}</div>}
          {shownTemplates.map((tp) => (
            <div className="card email-row" key={tp.id}>
              <div className="email-main">
                <b>{tp.name}</b>
                <div className="muted">{tp.subject || t("email.noSubject")} — {tp.preview || t("email.empty")}{tp.files > 0 && ` · 📎 ${tp.files}`}</div>
              </div>
              <div className="row">
                <button className="primary" onClick={() => applyTemplate(tp)}>{t("email.use")}</button>
                <button className="ghost" onClick={() => rename(tp)}>{t("email.rename")}</button>
                <button className="ghost danger" onClick={() => removeTemplate(tp)}>{t("email.delete")}</button>
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {shown.length === 0 && <div className="empty">{emails.length ? t("email.nothingHere") : t("email.none")}</div>}
          {shown.map((m) => (
            <Link to="/emails/$id" params={{ id: String(m.id) }} className="card email-row" key={m.id}>
              <div className="email-main">
                <div className="row" style={{ gap: "var(--s-2)" }}>
                  <span className={"chip " + (m.status === "sent" ? "posted" : m.status === "failed" ? "failed" : "")}>{STATUS[m.status] ? t(`email.${STATUS[m.status] as "sDraft"}`) : m.status}</span>
                  <b>{m.subject || t("email.noSubject")}</b>
                  {m.files > 0 && <span className="muted">📎 {m.files}</span>}
                  {m.job && <span className="chip scheduled" title={t("email.linkedJob")}>💼 {m.job.company}</span>}
                </div>
                <div className="muted">{t("email.to", { who: m.toAddr || t("email.nobody") })} — {m.preview || t("email.empty")}</div>
              </div>
              <div className="row">
                <span className="muted">{m.status === "sent" && m.sentAt ? day(m.sentAt) : day(m.updatedAt)}</span>
                <button className="ghost danger" onClick={(e) => remove(e, m)} aria-label={t("email.delete")}>✕</button>
              </div>
            </Link>
          ))}
        </>
      )}
    </>
  );
}

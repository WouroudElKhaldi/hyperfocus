import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useToast } from "../App.jsx";

const TABS = [["all", "All"], ["draft", "Drafts"], ["sent", "Sent"], ["failed", "Not sent"], ["templates", "Templates"]];
const day = (d) => new Date(d).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS = { draft: "Draft", sent: "✓ Sent", failed: "⚠️ Not sent", sending: "Sending…" };

export default function Emails() {
  const toast = useToast();
  const nav = useNavigate();
  const [emails, setEmails] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const load = () => {
    api.get("/emails").then(setEmails).catch((e) => toast(e.message, "err"));
    api.get("/email-templates").then(setTemplates).catch((e) => toast(e.message, "err"));
  };
  useEffect(() => { load(); }, []);

  const create = async () => nav(`/emails/${(await api.post("/emails")).id}`);
  const applyTemplate = async (t) => nav(`/emails/${(await api.post(`/email-templates/${t.id}/use`)).id}`);
  const rename = async (t) => {
    const name = window.prompt("Template name", t.name);
    if (!name?.trim()) return;
    await api.patch(`/email-templates/${t.id}`, { name }).catch((e) => toast(e.message, "err"));
    load();
  };
  const removeTemplate = async (t) => { if (confirm(`Delete the template “${t.name}”?`)) { await api.del(`/email-templates/${t.id}`); load(); } };
  const remove = async (e, m) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(m.status === "sent" ? "Delete this from your sent list? The email itself stays in your Gmail." : "Delete this email?")) return;
    await api.del(`/emails/${m.id}`);
    load();
  };

  const needle = q.trim().toLowerCase();
  const shown = emails.filter((m) => (tab === "all" || m.status === tab) && (!needle || `${m.toAddr} ${m.ccAddr} ${m.subject} ${m.preview}`.toLowerCase().includes(needle)));
  const count = (k) => (k === "templates" ? templates.length : emails.filter((m) => k === "all" || m.status === k).length);
  const shownTemplates = templates.filter((t) => !needle || `${t.name} ${t.subject} ${t.preview}`.toLowerCase().includes(needle));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Email</h1>
          <p className="sub">Write, polish and send from your Gmail. Every email you send is kept here.</p>
        </div>
        <button className="primary big" onClick={create}>+ New email</button>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-4)" }}>
        <div className="tabs" style={{ margin: 0 }}>
          {TABS.map(([k, label]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label} ({count(k)})</button>)}
        </div>
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search emails" style={{ maxWidth: 240 }} />
      </div>

      {tab === "templates" ? (
        <>
          {shownTemplates.length === 0 && <div className="empty">{templates.length ? "No template matches." : "No templates yet. Open an email and press “Save as template”."}</div>}
          {shownTemplates.map((t) => (
            <div className="card email-row" key={t.id}>
              <div className="email-main">
                <b>{t.name}</b>
                <div className="muted">{t.subject || "(no subject)"} — {t.preview || "(empty)"}{t.files > 0 && ` · 📎 ${t.files}`}</div>
              </div>
              <div className="row">
                <button className="primary" onClick={() => applyTemplate(t)}>Use</button>
                <button className="ghost" onClick={() => rename(t)}>Rename</button>
                <button className="ghost danger" onClick={() => removeTemplate(t)}>Delete</button>
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {shown.length === 0 && <div className="empty">{emails.length ? "Nothing here." : "No emails yet. Press “New email” to write your first one."}</div>}
          {shown.map((m) => (
            <Link to={`/emails/${m.id}`} className="card email-row" key={m.id}>
              <div className="email-main">
                <div className="row" style={{ gap: "var(--s-2)" }}>
                  <span className={"chip " + (m.status === "sent" ? "posted" : m.status === "failed" ? "failed" : "")}>{STATUS[m.status] || m.status}</span>
                  <b>{m.subject || "(no subject)"}</b>
                  {m.files > 0 && <span className="muted">📎 {m.files}</span>}
                  {m.job && <span className="chip scheduled" title="Linked job">💼 {m.job.company}</span>}
                </div>
                <div className="muted">To: {m.toAddr || "(nobody yet)"} — {m.preview || "(empty)"}</div>
              </div>
              <div className="row">
                <span className="muted">{m.status === "sent" && m.sentAt ? day(m.sentAt) : day(m.updatedAt)}</span>
                <button className="ghost danger" onClick={(e) => remove(e, m)} aria-label="Delete">✕</button>
              </div>
            </Link>
          ))}
        </>
      )}
    </>
  );
}

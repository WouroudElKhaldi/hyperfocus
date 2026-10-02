import { useEffect, useRef, useState } from "react";
import { api, errorOf } from "../api.ts";
import { useToast } from "../App.tsx";
import type { ChatMessage, ChatReply, ChatThread } from "../types.ts";

/** A message on screen. One being sent has a temporary id and no date yet. */
type Msg = Pick<ChatMessage, "id" | "role" | "content">;

const STARTERS = [
  "I'm overwhelmed and don't know where to start",
  "I can't make myself start",
  "I'm frustrated with myself",
  "I need some encouragement",
  "Help me plan the rest of my day",
  "Explain something I'm studying",
];

function SupportCard({ onClose }: { onClose?: () => void }) {
  return (
    <div className="support card" role="region" aria-label="Urgent support">
      <div className="row between">
        <h2>If you might hurt yourself, or you're in danger</h2>
        {onClose && <button className="ghost icon-btn" onClick={onClose} aria-label="Close">✕</button>}
      </div>
      <p>Please reach out to a person right now. You don't have to carry this alone.</p>
      <ul>
        <li><b>Lebanon:</b> the National Lifeline <a href="tel:1564"><b>1564</b></a>, free and confidential (from abroad: +961 1 341 941). Run by Embrace with the Ministry of Public Health.</li>
        <li>Your local <b>emergency number</b> if you're in immediate danger.</li>
        <li>Someone you trust: a friend, family member or colleague. Tell them you're not okay.</li>
      </ul>
      <p className="muted tiny">Check the current hours at embracelebanon.org. I'm an AI and can't replace a person or professional care.</p>
    </div>
  );
}

// A temporary chat only ever lives in memory: it survives moving between pages, but not closing or reloading the tab.
let TEMP: Msg[] = [];

const dayLabel = (d: string) => {
  const t = new Date(d), n = new Date();
  n.setHours(0, 0, 0, 0);
  const days = Math.floor((n.getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 864e5);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? "This week" : "Earlier";
};

type HistoryProps = {
  threads: ChatThread[]; activeId: number | null; mode: string;
  onOpen: (id: number) => void; onRename: (id: number, title: string) => Promise<void>; onDelete: (id: number) => void; onDeleteAll: () => void;
};
function History({ threads, activeId, mode, onOpen, onRename, onDelete, onDeleteAll }: HistoryProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [confirm, setConfirm] = useState<number | "all" | null>(null); // a thread id, or "all"
  const groups: { label: string; items: ChatThread[] }[] = [];
  for (const t of threads) {
    const l = dayLabel(t.updatedAt);
    let g = groups.find((x) => x.label === l);
    if (!g) { g = { label: l, items: [] }; groups.push(g); }
    g.items.push(t);
  }
  const commit = async () => { const id = editing; setEditing(null); if (id !== null && title.trim()) await onRename(id, title.trim()); };

  return (
    <nav className="chat-history" aria-label="Saved chats">
      {threads.length === 0 && <p className="muted tiny">Your saved chats will show up here.</p>}
      {groups.map((g) => (
        <div key={g.label} className="ch-group">
          <h3>{g.label}</h3>
          {g.items.map((t) => (
            <div key={t.id} className={"ch-item" + (mode === "saved" && activeId === t.id ? " on" : "")}>
              {editing === t.id ? (
                <input autoFocus className="ch-edit" value={title} maxLength={80} aria-label="Chat name" onChange={(e) => setTitle(e.target.value)} onBlur={commit}
                  onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }} />
              ) : (
                <button className="ch-open" onClick={() => onOpen(t.id)} title={t.title}>
                  <span className="ch-title">{t.title}</span>
                  <span className="muted tiny">{t.count} messages</span>
                </button>
              )}
              {confirm === t.id ? (
                <span className="ch-actions"><button className="danger-btn tiny-btn" onClick={() => { setConfirm(null); onDelete(t.id); }}>Delete</button><button className="ghost tiny-btn" onClick={() => setConfirm(null)}>Keep</button></span>
              ) : editing !== t.id && (
                <span className="ch-actions">
                  <button className="ghost tiny-btn" onClick={() => { setEditing(t.id); setTitle(t.title); }} aria-label={`Rename ${t.title}`}>Rename</button>
                  <button className="ghost tiny-btn" onClick={() => setConfirm(t.id)} aria-label={`Delete ${t.title}`}>Delete</button>
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
      {threads.length > 1 && (confirm === "all"
        ? <div className="row"><button className="danger-btn" onClick={() => { setConfirm(null); onDeleteAll(); }}>Delete all chats</button><button className="ghost" onClick={() => setConfirm(null)}>Keep them</button></div>
        : <button className="ghost" onClick={() => setConfirm("all")}>Delete all chats…</button>)}
    </nav>
  );
}

export default function Chat() {
  const toast = useToast();
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [mode, setMode] = useState(TEMP.length ? "temp" : "saved");
  const [threadId, setThreadId] = useState<number | null>(null); // null = a new chat that has not been saved yet
  const [msgs, setMsgs] = useState<Msg[]>(TEMP.length ? TEMP : []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const temp = mode === "temp";

  const loadThreads = () => api.get("/chat/threads").then(setThreads).catch((e) => { toast(e.message, "err"); setThreads([]); });
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  useEffect(() => { if (temp) TEMP = msgs; }, [msgs, temp]);

  const reset = (m: string) => { setMode(m); setThreadId(null); setMsgs([]); TEMP = []; setCrisis(false); setShowHistory(false); box.current?.focus(); };
  const newChat = () => reset("saved");
  const newTemp = () => reset("temp");
  const open = async (id: number) => {
    try {
      const r = await api.get(`/chat/threads/${id}`);
      setMode("saved"); setThreadId(id); setMsgs(r.messages); TEMP = []; setCrisis(false); setShowHistory(false);
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); loadThreads(); }
  };

  const send = async (t = text) => {
    const message = t.trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    const tmp: Msg = { id: `tmp${Date.now()}`, role: "user", content: message };
    const before = msgs;
    setMsgs((m) => [...m, tmp]);
    try {
      const out = await api.post("/chat", temp ? { message, temporary: true, history: before.map(({ role, content }) => ({ role, content })) } : { message, threadId });
      setMsgs((m) => [...m.filter((x) => x.id !== tmp.id), out.user, out.assistant]);
      if (out.thread) setThreadId(out.thread.id);
      if (!temp) loadThreads();
      if (out.crisis) setCrisis(true);
    } catch (caught) { const e = errorOf(caught);
      setMsgs((m) => m.filter((x) => x.id !== tmp.id));
      setText(message);
      toast(e.message, "err");
    }
    setBusy(false);
    box.current?.focus();
  };

  const rename = async (id: number, title: string) => { try { await api.patch(`/chat/threads/${id}`, { title }); loadThreads(); } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); } };
  const remove = async (id: number) => { await api.del(`/chat/threads/${id}`); if (id === threadId) newChat(); loadThreads(); };
  const removeAll = async () => { await api.del("/chat/threads"); newChat(); loadThreads(); toast("All saved chats deleted."); };

  return (
    <div className="chat-page">
      <header className="page-head">
        <div>
          <h1>Talk it out</h1>
          <p className="sub">A calm place to vent, get unstuck, or ask for help with study and work. Private to this computer.</p>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setShowHelp(!showHelp)}>Need urgent help?</button>
        </div>
      </header>

      {(crisis || showHelp) && <SupportCard onClose={() => { setCrisis(false); setShowHelp(false); }} />}

      <div className="chat-layout">
        <aside className={"chat-side card" + (showHistory ? " open" : "")}>
          <div className="chat-side-top">
            <button className="primary" onClick={newChat}>+ New chat</button>
            <button className={"ghost" + (temp ? " on" : "")} onClick={newTemp} aria-pressed={temp} title="Nothing is saved. It disappears when you close this page.">Temporary chat</button>
          </div>
          {threads === null ? <p className="muted tiny">Loading…</p> : <History threads={threads} activeId={threadId} mode={mode} onOpen={open} onRename={rename} onDelete={remove} onDeleteAll={removeAll} />}
        </aside>

        <section className="chat-main">
          <div className="chat-bar">
            <button className="ghost chat-hist-btn" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>History{threads?.length ? ` (${threads.length})` : ""}</button>
            {temp
              ? <span className="temp-badge" role="status">Temporary chat: not saved. It disappears when you close this page.</span>
              : threadId && <span className="muted tiny">Saved automatically</span>}
          </div>
          <div className={"card chat-card" + (temp ? " is-temp" : "")}>
            <div className="chat-log" aria-live="polite">
              {msgs.length === 0 && (
                <div className="chat-empty">
                  <p><b>{temp ? "Off the record." : "Hi. I'm here."}</b> {temp ? "Say anything. This chat won't be saved anywhere." : "Tell me what's going on, in any words. Messy is fine."}</p>
                  <div className="chip-row">
                    {STARTERS.map((s) => <button key={s} className="trait" onClick={() => send(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={"bubble-row " + m.role}>
                  <div className={"msg " + m.role}>{m.content}</div>
                </div>
              ))}
              {busy && <div className="bubble-row assistant"><div className="msg assistant typing" aria-label="Thinking"><i /><i /><i /></div></div>}
              <div ref={end} />
            </div>

            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea ref={box} id="chat-text" rows={1} placeholder="Write here… (Enter to send, Shift+Enter for a new line)" value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="primary" disabled={!text.trim() || busy}>Send</button>
            </form>
          </div>
          <p className="muted tiny">This is an AI companion, not a therapist or a person. For anything serious, please talk to someone you trust or a professional.</p>
        </section>
      </div>
    </div>
  );
}

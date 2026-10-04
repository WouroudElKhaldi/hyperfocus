import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useDeleteThreads, useOpenThread, useRenameThread, useSendChat, useThreads } from "../api.ts";
import { useToast } from "../../../App.tsx";
import type { ChatMessage, ChatReply, ChatThread } from "../../../types.ts";

/** A message on screen. One being sent has a temporary id and no date yet. */
type Msg = Pick<ChatMessage, "id" | "role" | "content">;

// (in the chosen language: a starter is sent to the AI as written)
const STARTERS = () => (["s1", "s2", "s3", "s4", "s5", "s6"] as const).map((k) => i18next.t(`chat.${k}`));

function SupportCard({ onClose }: { onClose?: () => void }) {
  return (
    <div className="support card" role="region" aria-label={i18next.t("chat.urgentSupport")}>
      <div className="row between">
        <h2>{i18next.t("chat.ifYouMightHurt")}</h2>
        {onClose && <button className="ghost icon-btn" onClick={onClose} aria-label={i18next.t("chat.close")}>✕</button>}
      </div>
      <p>{i18next.t("chat.pleaseReachOutTo")}</p>
      <ul>
        <li><b>{i18next.t("chat.lebanon")}</b> {i18next.t("chat.theNationalLifeline")} <a href="tel:1564"><b>1564</b></a>{i18next.t("chat.freeAndConfidentialFrom")}</li>
        <li>{i18next.t("chat.yourLocal")} <b>{i18next.t("chat.emergencyNumber")}</b> {i18next.t("chat.ifYouReIn")}</li>
        <li>{i18next.t("chat.someoneYouTrustA")}</li>
      </ul>
      <p className="muted tiny">{i18next.t("chat.checkTheCurrentHours")}</p>
    </div>
  );
}

// A temporary chat only ever lives in memory: it survives moving between pages, but not closing or reloading the tab.
let TEMP: Msg[] = [];

const dayLabel = (d: string) => {
  const t = new Date(d), n = new Date();
  n.setHours(0, 0, 0, 0);
  const days = Math.floor((n.getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 864e5);
  return days <= 0 ? i18next.t("chat.today") : days === 1 ? i18next.t("chat.yesterday") : days < 7 ? i18next.t("chat.thisWeek") : i18next.t("chat.earlier");
};

type HistoryProps = {
  threads: ChatThread[]; activeId: number | null; mode: string;
  onOpen: (id: number) => void; onRename: (id: number, title: string) => void; onDelete: (id: number) => void; onDeleteAll: () => void;
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
  const commit = () => { const id = editing; setEditing(null); if (id !== null && title.trim()) onRename(id, title.trim()); };

  return (
    <nav className="chat-history" aria-label={i18next.t("chat.savedChats")}>
      {threads.length === 0 && <p className="muted tiny">{i18next.t("chat.yourSavedChatsWill")}</p>}
      {groups.map((g) => (
        <div key={g.label} className="ch-group">
          <h3>{g.label}</h3>
          {g.items.map((t) => (
            <div key={t.id} className={"ch-item" + (mode === "saved" && activeId === t.id ? " on" : "")}>
              {editing === t.id ? (
                <input autoFocus className="ch-edit" value={title} maxLength={80} aria-label={i18next.t("chat.chatName")} onChange={(e) => setTitle(e.target.value)} onBlur={commit}
                  onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }} />
              ) : (
                <button className="ch-open" onClick={() => onOpen(t.id)} title={t.title}>
                  <span className="ch-title">{t.title}</span>
                  <span className="muted tiny">{t.count} messages</span>
                </button>
              )}
              {confirm === t.id ? (
                <span className="ch-actions"><button className="danger-btn tiny-btn" onClick={() => { setConfirm(null); onDelete(t.id); }}>{i18next.t("chat.delete")}</button><button className="ghost tiny-btn" onClick={() => setConfirm(null)}>{i18next.t("chat.keep")}</button></span>
              ) : editing !== t.id && (
                <span className="ch-actions">
                  <button className="ghost tiny-btn" onClick={() => { setEditing(t.id); setTitle(t.title); }} aria-label={`Rename ${t.title}`}>{i18next.t("chat.rename")}</button>
                  <button className="ghost tiny-btn" onClick={() => setConfirm(t.id)} aria-label={`Delete ${t.title}`}>{i18next.t("chat.delete")}</button>
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
      {threads.length > 1 && (confirm === "all"
        ? <div className="row"><button className="danger-btn" onClick={() => { setConfirm(null); onDeleteAll(); }}>{i18next.t("chat.deleteAllChats")}</button><button className="ghost" onClick={() => setConfirm(null)}>{i18next.t("chat.keepThem")}</button></div>
        : <button className="ghost" onClick={() => setConfirm("all")}>{i18next.t("chat.deleteAllChats2")}</button>)}
    </nav>
  );
}

export default function Chat() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const threads = useThreads().data ?? null;
  const sendChat = useSendChat();
  const openThread = useOpenThread();
  const renameThread = useRenameThread();
  const deleteThreads = useDeleteThreads();
  const [mode, setMode] = useState(TEMP.length ? "temp" : "saved");
  const [threadId, setThreadId] = useState<number | null>(null); // null = a new chat that has not been saved yet
  const [msgs, setMsgs] = useState<Msg[]>(TEMP.length ? TEMP : []);
  const [text, setText] = useState("");
  const [crisis, setCrisis] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const temp = mode === "temp";

  const busy = sendChat.isPending;
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);
  useEffect(() => { if (temp) TEMP = msgs; }, [msgs, temp]);

  const reset = (m: string) => { setMode(m); setThreadId(null); setMsgs([]); TEMP = []; setCrisis(false); setShowHistory(false); box.current?.focus(); };
  const newChat = () => reset("saved");
  const newTemp = () => reset("temp");
  const open = (id: number) =>
    openThread.mutate(id, {
      onSuccess: (r) => { setMode("saved"); setThreadId(id); setMsgs(r.messages); TEMP = []; setCrisis(false); setShowHistory(false); },
    });

  // the message shows at once; if it fails it goes back into the box (the reason shows in a toast)
  const send = (t = text) => {
    const message = t.trim();
    if (!message || busy) return;
    setText("");
    const tmp: Msg = { id: `tmp${Date.now()}`, role: "user", content: message };
    const before = msgs;
    setMsgs((m) => [...m, tmp]);
    sendChat.mutate(temp ? { message, temporary: true, history: before.map(({ role, content }) => ({ role, content })) } : { message, threadId }, {
      onSuccess: (out) => {
        setMsgs((m) => [...m.filter((x) => x.id !== tmp.id), out.user, out.assistant]);
        if (out.thread) setThreadId(out.thread.id);
        if (out.crisis) setCrisis(true);
      },
      onError: () => { setMsgs((m) => m.filter((x) => x.id !== tmp.id)); setText(message); },
      onSettled: () => box.current?.focus(),
    });
  };

  const rename = (id: number, title: string) => renameThread.mutate({ id, title });
  const remove = (id: number) => deleteThreads.mutate(id, { onSuccess: () => { if (id === threadId) newChat(); } });
  const removeAll = () => deleteThreads.mutate(undefined, { onSuccess: () => { newChat(); toast(i18next.t("chat.allSavedChatsDeleted")); } });

  return (
    <div className="chat-page">
      <header className="page-head">
        <div>
          <h1>{i18next.t("chat.talkItOut")}</h1>
          <p className="sub">{i18next.t("chat.aCalmPlaceTo")}</p>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setShowHelp(!showHelp)}>{i18next.t("chat.needUrgentHelp")}</button>
        </div>
      </header>

      {(crisis || showHelp) && <SupportCard onClose={() => { setCrisis(false); setShowHelp(false); }} />}

      <div className="chat-layout">
        <aside className={"chat-side card" + (showHistory ? " open" : "")}>
          <div className="chat-side-top">
            <button className="primary" onClick={newChat}>{i18next.t("chat.newChat")}</button>
            <button className={"ghost" + (temp ? " on" : "")} onClick={newTemp} aria-pressed={temp} title={i18next.t("chat.nothingIsSavedIt")}>{i18next.t("chat.temporaryChat")}</button>
          </div>
          {threads === null ? <p className="muted tiny">{i18next.t("chat.loading")}</p> : <History threads={threads} activeId={threadId} mode={mode} onOpen={open} onRename={rename} onDelete={remove} onDeleteAll={removeAll} />}
        </aside>

        <section className="chat-main">
          <div className="chat-bar">
            <button className="ghost chat-hist-btn" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>History{threads?.length ? ` (${threads.length})` : ""}</button>
            {temp
              ? <span className="temp-badge" role="status">{i18next.t("chat.temporaryChatNotSaved")}</span>
              : threadId && <span className="muted tiny">{i18next.t("chat.savedAutomatically")}</span>}
          </div>
          <div className={"card chat-card" + (temp ? " is-temp" : "")}>
            <div className="chat-log" aria-live="polite">
              {msgs.length === 0 && (
                <div className="chat-empty">
                  <p><b>{temp ? i18next.t("chat.offTheRecord") : i18next.t("chat.hiIMHere")}</b> {temp ? i18next.t("chat.sayAnythingThisChat") : i18next.t("chat.tellMeWhatS")}</p>
                  <div className="chip-row">
                    {STARTERS().map((s) => <button key={s} className="trait" onClick={() => send(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={"bubble-row " + m.role}>
                  <div className={"msg " + m.role}>{m.content}</div>
                </div>
              ))}
              {busy && <div className="bubble-row assistant"><div className="msg assistant typing" aria-label={i18next.t("chat.thinking")}><i /><i /><i /></div></div>}
              <div ref={end} />
            </div>

            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea ref={box} id="chat-text" rows={1} placeholder={i18next.t("chat.writeHereEnterTo")} value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="primary" disabled={!text.trim() || busy}>{i18next.t("chat.send")}</button>
            </form>
          </div>
          <p className="muted tiny">{i18next.t("chat.thisIsAnAi")}</p>
        </section>
      </div>
    </div>
  );
}

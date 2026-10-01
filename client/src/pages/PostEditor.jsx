import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useToast } from "../App.jsx";
import LoadProblem, { isId, notFound } from "../components/LoadProblem.jsx";

const LIMIT = 3000;
const QUICK = ["Make it shorter", "Stronger hook", "More personal", "Simpler words", "Add a question at the end"];

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (d) => {
  d = new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const tomorrowAt = (h) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
const fmtWhen = (d) => new Date(d).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS = { draft: "Draft", scheduled: "⏰ Scheduled", posting: "Sending…", posted: "✓ Posted", failed: "⚠️ Failed", missed: "⚠️ Missed" };

// Top-level so the date input keeps focus while the editor re-renders.
function Schedule({ post, blockedReason, flush, onChange }) {
  const toast = useToast();
  const [when, setWhen] = useState(() => toLocalInput(post.status === "scheduled" && post.scheduledAt ? post.scheduledAt : tomorrowAt(9)));
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);

  const schedule = async () => {
    if (!when || isNaN(new Date(when))) return toast("Pick a date and time first.", "err");
    setBusy(true);
    try {
      await flush(); // make sure the latest text is what gets posted
      onChange(await api.post(`/posts/${post.id}/schedule`, { scheduledAt: new Date(when).toISOString() }));
      setChanging(false);
      toast("Scheduled ⏰ It will post by itself at that time.");
    } catch (e) { toast(e.message, "err"); }
    setBusy(false);
  };
  const cancel = async () => {
    try { onChange(await api.post(`/posts/${post.id}/unschedule`)); toast("Schedule cancelled. It's a draft again."); }
    catch (e) { toast(e.message, "err"); }
  };

  if (post.status === "posted") return null;

  const picker = (
    <div className="row" style={{ marginTop: "var(--s-2)" }}>
      <input type="datetime-local" style={{ width: "auto" }} value={when} onChange={(e) => setWhen(e.target.value)} />
      <button className="ghost" onClick={() => setWhen(toLocalInput(Date.now() + 3600000))}>In 1 hour</button>
      <button className="ghost" onClick={() => setWhen(toLocalInput(tomorrowAt(9)))}>Tomorrow 9:00</button>
      <button className="primary" disabled={busy} onClick={schedule}>{busy ? "Saving…" : "📅 Schedule"}</button>
      {changing && <button className="ghost" onClick={() => setChanging(false)}>Cancel</button>}
    </div>
  );

  if (post.status === "scheduled" || post.status === "posting") {
    return (
      <div className="verdict v-ok" style={{ marginTop: "var(--s-4)" }}>
        <b>{post.status === "posting" ? "📤 Sending to LinkedIn…" : `⏰ Scheduled for ${fmtWhen(post.scheduledAt)}`}</b>
        {post.status === "scheduled" && (
          <>
            <p>If you haven't posted it by then, the app posts it for you. The app and n8n must be running.
              {post.attempts > 0 && <> Last try failed ({post.attempts}/3): {post.lastError}</>}</p>
            {changing ? picker : (
              <div className="row">
                <button className="ghost" onClick={() => setChanging(true)}>Change time</button>
                <button className="ghost" onClick={cancel}>Cancel schedule</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="schedule-box" style={{ marginTop: "var(--s-4)" }}>
      {(post.status === "failed" || post.status === "missed") && (
        <div className="verdict v-bad" style={{ marginBottom: "var(--s-3)" }}>
          <b>{post.status === "missed" ? "⚠️ It wasn't posted on time" : "⚠️ Auto-post failed"}</b>
          <p className="pre">{post.lastError}</p>
        </div>
      )}
      <b>📅 Schedule it</b> <span className="muted">(auto-posts at that time if you haven't posted it yourself)</span>
      {blockedReason ? <p className="muted" style={{ marginTop: "var(--s-2)" }}>{blockedReason}</p> : picker}
    </div>
  );
}

export default function PostEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [post, setPost] = useState(null);
  const [thought, setThought] = useState("");
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState([]);
  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [changes, setChanges] = useState([]);
  const [thoughtHistory, setThoughtHistory] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [hookType, setHookType] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const loaded = useRef(false);
  const [loadErr, setLoadErr] = useState(null);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"

  useEffect(() => {
    setLoadErr(null);
    if (!isId(id)) { setLoadErr(notFound); return; }
    api.get(`/posts/${id}`).then((p) => {
      setPost(p); setThought(p.thought); setDraft(p.draft);
      setTimeout(() => (loaded.current = true), 0);
    }).catch(setLoadErr);
  }, [id, attempt]);

  // while it is scheduled, keep the status fresh (only the status fields, never the text you're editing)
  useEffect(() => {
    if (!post || !["scheduled", "posting"].includes(post.status)) return;
    const t = setInterval(async () => {
      try {
        const p = await api.get(`/posts/${id}`);
        if (p.status !== post.status) {
          setPost((cur) => ({ ...cur, status: p.status, postedAt: p.postedAt, scheduledAt: p.scheduledAt, attempts: p.attempts, lastError: p.lastError }));
          if (p.status === "posted") toast("Your scheduled post just went live on LinkedIn 🎉");
        }
      } catch { /* server briefly unavailable, try again next tick */ }
    }, 15000);
    return () => clearInterval(t);
  }, [post?.status, id]);

  // autosave 800ms after typing stops
  useEffect(() => {
    if (!loaded.current) return;
    setSaved(false);
    const t = setTimeout(() => {
      api.patch(`/posts/${id}`, { thought, draft }).then(() => setSaved(true)).catch((e) => toast(e.message, "err"));
    }, 800);
    return () => clearTimeout(t);
  }, [thought, draft]);

  const applyAI = async (instr) => {
    setBusy(true);
    try {
      const out = await api.post("/ai/rewrite", { thought, draft: instr ? draft : undefined, instruction: instr });
      setHistory((h) => [...h, draft]);
      setDraft(out.draft);
      setSuggestions(out.suggestions);
      setChanges([]);
      if (!instr || out.hooks?.length) { setHooks(out.hooks || []); setHookType(out.hookType || ""); }
      setInstruction("");
    } catch (e) { toast(e.message, "err"); }
    setBusy(false);
  };

  const polish = async () => {
    setBusy(true);
    try {
      // cleans the thought itself (tiny fixes only) BEFORE generating a post; the previous text is kept for undo
      const out = await api.post("/ai/polish", { text: thought });
      if (out.draft === thought) toast("Already clean, nothing to fix ✨");
      else { setThoughtHistory((h) => [...h, thought]); setThought(out.draft); }
      setChanges(out.changes);
    } catch (e) { toast(e.message, "err"); }
    setBusy(false);
  };

  const undoThought = () => {
    setThought(thoughtHistory[thoughtHistory.length - 1]);
    setThoughtHistory((h) => h.slice(0, -1));
    setChanges([]);
  };

  const undo = () => { setDraft(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); };

  // LinkedIn's API can't create real tags, so posts with an @mention are finished on linkedin.com
  const hasMention = /(^|\s)@[\p{L}\d_]/u.test(draft);

  const publish = async () => {
    if (hasMention) {
      await navigator.clipboard.writeText(draft).catch(() => {});
      window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank");
      toast("Copied! In LinkedIn, paste it, delete the @name and retype it, then pick the person from the dropdown so they get tagged. Come back and press “Mark as posted”.");
      return;
    }
    if (!confirm("Post this to LinkedIn now?")) return;
    setBusy(true);
    try {
      await api.patch(`/posts/${id}`, { thought, draft });
      setPost(await api.post(`/posts/${id}/publish`));
      toast("Posted to LinkedIn! 🎉 Proud of you.");
    } catch (e) {
      if (e.code === "n8n_not_configured") {
        await navigator.clipboard.writeText(draft).catch(() => {});
        window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank");
        toast("n8n isn't connected yet, so I copied your post. Paste it in LinkedIn, then hit “Mark as posted”.");
      } else toast(e.message, "err");
    }
    setBusy(false);
  };

  const markPosted = async () => setPost(await api.post(`/posts/${id}/mark-posted`));
  const remove = async () => { if (confirm("Delete this post?")) { await api.del(`/posts/${id}`); nav("/posts"); } };

  if (loadErr) return <LoadProblem error={loadErr} what="post" back="/posts" backLabel="Back to posts" onRetry={() => setAttempt((a) => a + 1)} />;
  if (!post) return <p className="muted">Loading…</p>;
  const posted = post.status === "posted";

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Post editor</h1>
          <p className="sub">
            <span className={"chip " + post.status}>{STATUS[post.status] || post.status}</span>{" "}
            {saved ? "Saved" : "Saving…"}
          </p>
        </div>
        <button className="ghost" onClick={remove}>Delete</button>
      </div>

      <div className="grid2 editor">
        <div className="card">
          <h2>My original thought</h2>
          <textarea value={thought} onChange={(e) => setThought(e.target.value)} placeholder="Type your raw thoughts. Bullets, fragments, anything." />
          <p className="muted">Only “Tiny polish” edits this box, and only typos. Everything else just reads it.</p>
          <div className="row">
            <button className="primary" disabled={busy || !thought.trim()} onClick={() => applyAI()} title="Writes a new LinkedIn post from your thought (replaces the current draft)">
              {busy ? "Working…" : draft.trim() ? "🔄 Rewrite from scratch" : "✨ Turn into a LinkedIn post"}
            </button>
            <button disabled={busy || !thought.trim()} onClick={polish} title="Fixes only typos, grammar and punctuation in your thought. Keeps your words. Do this before generating the post.">
              {busy ? "Working…" : "🪶 Tiny polish"}
            </button>
            <button className="ghost" disabled={!thoughtHistory.length} onClick={undoThought}>↶ Undo polish</button>
          </div>
          {changes.length > 0 && (
            <div className="hookbox" style={{ marginTop: "var(--s-3)" }}>
              <b>Tiny polish fixed:</b> {changes.join(" · ")}
            </div>
          )}
        </div>

        <div className="card">
          <h2>LinkedIn draft</h2>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your draft will appear here. You can also write it yourself." />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">{hookType && `Hook style: ${hookType}`}</span>
            <div className={"count" + (draft.length > LIMIT ? " over" : "")}>{draft.length} / {LIMIT}</div>
          </div>
          {draft && (
            <div className="hookbox">
              <b>Visible before “see more”:</b> <span className="pre">{draft.slice(0, 140)}{draft.length > 140 && <span className="muted">… see more</span>}</span>
            </div>
          )}
          {hooks.length > 0 && (
            <>
              <p className="muted" style={{ marginTop: "var(--s-3)" }}>Other hooks to try (click to swap the opening):</p>
              <div className="sugg">
                {hooks.map((h, i) => (
                  <button key={i} disabled={busy} onClick={() => applyAI(`Replace ONLY the opening hook with exactly this line, and adjust the following line so it flows: "${h}"`)}>🪝 {h}</button>
                ))}
              </div>
            </>
          )}

          <div className="row" style={{ marginTop: "var(--s-2)" }}>
            <input className="grow" placeholder="Ask AI to edit… e.g. “make it less formal”" value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && instruction.trim() && draft.trim() && applyAI(instruction)} />
            <button disabled={busy || !instruction.trim() || !draft.trim()} onClick={() => applyAI(instruction)}>Edit</button>
          </div>
          <div className="sugg">
            {QUICK.map((q) => <button key={q} disabled={busy || !draft.trim()} onClick={() => applyAI(q)}>{q}</button>)}
          </div>
          {suggestions.length > 0 && (
            <>
              <p className="muted" style={{ marginTop: "var(--s-4)" }}>AI suggestions (click to apply):</p>
              <div className="sugg">
                {suggestions.map((s, i) => <button key={i} disabled={busy} onClick={() => applyAI(s)}>💡 {s}</button>)}
              </div>
            </>
          )}

          {hasMention && !posted && (
            <div className="hookbox" style={{ marginTop: "var(--s-3)" }}>
              👋 <b>You're tagging someone.</b> LinkedIn only allows real tags when posting on linkedin.com, so the button will copy your post and open LinkedIn. There, retype the @name and choose them from the dropdown.
            </div>
          )}
          {!posted && (
            <Schedule
              post={post}
              flush={() => api.patch(`/posts/${id}`, { thought, draft })}
              onChange={(p) => setPost(p)}
              blockedReason={
                !draft.trim() ? "Write the draft first." :
                draft.length > LIMIT ? "The draft is over LinkedIn's 3000 character limit." :
                hasMention ? "Posts that tag someone (@name) can't be auto-posted, because the tag would come out as plain text. Post this one by hand, using the button below." :
                ""
              }
            />
          )}
          <div className="row" style={{ marginTop: "var(--s-4)" }}>
            <button className="ghost" disabled={!history.length} onClick={undo}>↶ Undo AI edit</button>
            <button className="ghost" onClick={() => { navigator.clipboard.writeText(draft); toast("Copied"); }}>Copy</button>
            <span className="grow" />
            {!posted && <button className="ghost" onClick={markPosted}>Mark as posted</button>}
            <button className="primary big" disabled={busy || posted || !draft.trim() || draft.length > LIMIT} onClick={publish}>
              {posted ? "✓ Posted" : hasMention ? "🚀 Copy & open LinkedIn" : "🚀 POST"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

import { type MouseEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useToast } from "../App.tsx";
import type { Post } from "../types.ts";

const FILTERS: [string, string][] = [["all", "All"], ["draft", "Drafts"], ["scheduled", "Scheduled"], ["posted", "Posted"]];
const textOf = (p: Post) => (p.draft || p.thought).trim();
const statusLabel = (p: Post) => p.status === "posted" ? "✓ Posted" : p.status === "scheduled" ? `⏰ ${new Date(p.scheduledAt ?? "").toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : p.status === "failed" ? "⚠️ Failed" : p.status === "missed" ? "⚠️ Missed" : p.status === "posting" ? "Sending…" : "Draft";
const titleOf = (p: Post) => textOf(p).split("\n").find((l) => l.trim()) || "(empty)";

function load(key: string, fallback: string) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage can be unavailable */ }
}

export default function Posts() {
  const toast = useToast();
  const nav = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState(() => load("posts-view", "table"));
  const [filter, setFilter] = useState("all");

  const refresh = () => api.get("/posts").then(setPosts).catch((e) => toast(e.message, "err"));
  useEffect(() => { refresh(); }, []);

  const changeView = (v: string) => { setView(v); save("posts-view", v); };
  const create = async () => {
    const p = await api.post("/posts", { thought: "(write your raw thought here)" });
    nav(`/posts/${p.id}`);
  };
  const remove = async (e: MouseEvent, p: Post) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this post?")) return;
    await api.del(`/posts/${p.id}`);
    refresh();
  };

  const shown = posts.filter((p) => filter === "all" || p.status === filter);
  const count = (f: string) => posts.filter((p) => f === "all" || p.status === f).length;
  const when = (p: Post) => new Date(p.updatedAt).toLocaleDateString([], { day: "numeric", month: "short" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>LinkedIn posts</h1>
          <p className="sub">Your words in, a polished post out.</p>
        </div>
        <button className="primary big" onClick={create}>+ New post</button>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-4)" }}>
        <div className="tabs" style={{ margin: 0 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{label} ({count(k)})</button>
          ))}
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={view === "table" ? "on" : ""} onClick={() => changeView("table")} title="Table">☰ Table</button>
          <button className={view === "cards" ? "on" : ""} onClick={() => changeView("cards")} title="Small cards">▦ Cards</button>
        </div>
      </div>

      {shown.length === 0 && <div className="empty">{posts.length ? "Nothing in this filter." : "No posts yet. Start with your SE Square notes!"}</div>}

      {shown.length > 0 && view === "table" && (
        <div className="card table-card">
          <table className="ptable">
            <thead>
              <tr><th>Status</th><th>Post</th><th className="num">Chars</th><th>Updated</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} onClick={() => nav(`/posts/${p.id}`)}>
                  <td><span className={"chip " + p.status}>{statusLabel(p)}</span></td>
                  <td className="ptitle"><Link to={`/posts/${p.id}`} onClick={(e) => e.stopPropagation()}>{titleOf(p)}</Link></td>
                  <td className="num muted">{textOf(p).length}</td>
                  <td className="muted nowrap">{when(p)}</td>
                  <td className="nowrap"><button className="ghost" title="Delete" onClick={(e) => remove(e, p)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > 0 && view === "cards" && (
        <div className="mini-grid">
          {shown.map((p) => (
            <Link to={`/posts/${p.id}`} key={p.id} className="mini-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className={"chip " + p.status}>{statusLabel(p)}</span>
                <span className="muted">{when(p)}</span>
              </div>
              <div className="mini-title">{titleOf(p)}</div>
              <div className="mini-text">{textOf(p).slice(titleOf(p).length).trim()}</div>
              <div className="mini-foot muted">
                <span>{textOf(p).length} chars</span>
                <button className="ghost" title="Delete" onClick={(e) => remove(e, p)}>✕</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

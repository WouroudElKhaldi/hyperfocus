import { type MouseEvent, useState } from "react";
import { dateLocale } from "../../../i18n/locale.ts";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Post } from "../../../types.ts";
import { useCreatePost, useDeletePost, usePosts } from "../api.ts";

const FILTERS: [string, "all" | "drafts" | "scheduled" | "posted"][] = [["all", "all"], ["draft", "drafts"], ["scheduled", "scheduled"], ["posted", "posted"]];
const textOf = (p: Post) => (p.draft || p.thought).trim();
const statusLabel = (p: Post) => p.status === "posted" ? i18next.t("posts.sPosted") : p.status === "scheduled" ? `⏰ ${new Date(p.scheduledAt ?? "").toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : p.status === "failed" ? i18next.t("posts.sFailed") : p.status === "missed" ? i18next.t("posts.sMissed") : p.status === "posting" ? i18next.t("posts.sPosting") : i18next.t("posts.sDraft");
const titleOf = (p: Post) => textOf(p).split("\n").find((l) => l.trim()) || i18next.t("posts.empty");

function load(key: string, fallback: string) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage can be unavailable */ }
}

export default function Posts() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const posts = usePosts().data ?? [];
  const createPost = useCreatePost();
  const deletePost = useDeletePost();
  const [view, setView] = useState(() => load("posts-view", "table"));
  const [filter, setFilter] = useState("all");

  const changeView = (v: string) => { setView(v); save("posts-view", v); };
  const create = () =>
    createPost.mutate(t("posts.newThought"), { onSuccess: (p) => nav({ to: "/posts/$id", params: { id: String(p.id) } }) });
  const remove = (e: MouseEvent, p: Post) => {
    e.preventDefault(); e.stopPropagation();
    if (confirm(t("posts.deleteAsk"))) deletePost.mutate(p.id);
  };

  const shown = posts.filter((p) => filter === "all" || p.status === filter);
  const count = (f: string) => posts.filter((p) => f === "all" || p.status === f).length;
  const when = (p: Post) => new Date(p.updatedAt).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("posts.title")}</h1>
          <p className="sub">{t("posts.sub")}</p>
        </div>
        <button className="primary big" onClick={create}>{t("posts.new")}</button>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--s-4)" }}>
        <div className="tabs" style={{ margin: 0 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{t(`posts.${label}`)} ({count(k)})</button>
          ))}
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={view === "table" ? "on" : ""} onClick={() => changeView("table")} title={t("posts.tableHint")}>{t("posts.table")}</button>
          <button className={view === "cards" ? "on" : ""} onClick={() => changeView("cards")} title={t("posts.cardsHint")}>{t("posts.cards")}</button>
        </div>
      </div>

      {shown.length === 0 && <div className="empty">{posts.length ? t("posts.nothingFilter") : t("posts.none")}</div>}

      {shown.length > 0 && view === "table" && (
        <div className="card table-card">
          <table className="ptable">
            <thead>
              <tr><th>{t("posts.colStatus")}</th><th>{t("posts.colPost")}</th><th className="num">{t("posts.colChars")}</th><th>{t("posts.colUpdated")}</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} onClick={() => nav({ to: "/posts/$id", params: { id: String(p.id) } })}>
                  <td><span className={"chip " + p.status}>{statusLabel(p)}</span></td>
                  <td className="ptitle"><Link to="/posts/$id" params={{ id: String(p.id) }} onClick={(e) => e.stopPropagation()}>{titleOf(p)}</Link></td>
                  <td className="num muted">{textOf(p).length}</td>
                  <td className="muted nowrap">{when(p)}</td>
                  <td className="nowrap"><button className="ghost" title={t("posts.delete")} aria-label={t("posts.delete")} onClick={(e) => remove(e, p)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > 0 && view === "cards" && (
        <div className="mini-grid">
          {shown.map((p) => (
            <Link to="/posts/$id" params={{ id: String(p.id) }} key={p.id} className="mini-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className={"chip " + p.status}>{statusLabel(p)}</span>
                <span className="muted">{when(p)}</span>
              </div>
              <div className="mini-title">{titleOf(p)}</div>
              <div className="mini-text">{textOf(p).slice(titleOf(p).length).trim()}</div>
              <div className="mini-foot muted">
                <span>{t("posts.chars", { count: textOf(p).length })}</span>
                <button className="ghost" title={t("posts.delete")} aria-label={t("posts.delete")} onClick={(e) => remove(e, p)}>✕</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { api, KINDS } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import More from "../../../components/More.tsx";
import type { Note } from "../../../types.ts";
import { useAddTask } from "../../tasks/index.ts";
import { useAddNote, useDeleteNote, useNotes, useUpdateNote } from "../api.ts";

export default function Notes() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const nav = useNavigate();
  const notes = useNotes().data ?? [];
  const addNote = useAddNote();
  const update = useUpdateNote();
  const deleteNote = useDeleteNote();
  const addTask = useAddTask();
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("active"); // active | posted | archived
  const [editing, setEditing] = useState<Note | null>(null);
  const [draft, setDraft] = useState({ kind: "thought", title: "", body: "" });

  const add = () => addNote.mutate(draft, { onSuccess: () => setDraft({ ...draft, title: "", body: "" }) });
  const saveEdit = () => {
    if (!editing) return;
    const { id, kind, title, body } = editing;
    update.mutate({ id, change: { kind, title, body } }, { onSuccess: () => setEditing(null) });
  };
  const remove = (n: Note) => {
    if (confirm(i18next.t("notes.deleteThisForGood"))) deleteNote.mutate(n.id);
  };
  const pin = (n: Note) => update.mutate({ id: n.id, change: { pinned: !n.pinned } });
  const archive = (n: Note) =>
    update.mutate(
      { id: n.id, change: { archived: !n.archived } },
      {
        onSuccess: () =>
          toast(n.archived ? i18next.t("notes.movedBackToYour") : i18next.t("notes.archivedItSKept")),
      },
    );
  // a note that already has a post opens that post instead of making a second one
  const toPost = async (n: Note) => {
    if (n.postIds.length) return nav({ to: "/posts/$id", params: { id: String(n.postIds.at(-1)) } });
    const p = await api.post("/posts", { thought: n.body, noteId: n.id });
    nav({ to: "/posts/$id", params: { id: String(p.id) } });
  };
  const toTask = (n: Note) =>
    addTask.mutate({ title: n.title || n.body.slice(0, 80) }, { onSuccess: () => toast(i18next.t("notes.addedToYourTasks")) });

  // a thought that became a published post leaves the main list (it is still under "Posted")
  const inView = (n: Note) =>
    view === "archived" ? n.archived : view === "posted" ? n.posted && !n.archived : !n.archived && !n.posted;
  const counts = {
    posted: notes.filter((n) => n.posted && !n.archived).length,
    archived: notes.filter((n) => n.archived).length,
  };
  const shown = notes.filter((n) => inView(n) && (view !== "active" || filter === "all" || n.kind === filter));

  return (
    <>
      <h1>{i18next.t("notes.thoughtsIdeas")}</h1>
      <p className="sub">{i18next.t("notes.writeItDownTurn")}</p>

      <div className="card">
        <textarea
          placeholder={i18next.t("notes.writeItDown")}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <button className="primary" disabled={!draft.body.trim() || addNote.isPending} onClick={add}>
            {i18next.t("notes.add")}
          </button>
          <More label={i18next.t("notes.titleAndType")} className="inline">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} aria-label={i18next.t("notes.kind")}>
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              placeholder={i18next.t("notes.titleOptional")}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </More>
        </div>
      </div>

      <div className="tabs">
        {[["all", "All"] as [string, string], ...Object.entries(KINDS)].map(([k, v]) => (
          <button
            key={k}
            className={view === "active" && filter === k ? "on" : ""}
            onClick={() => {
              setView("active");
              setFilter(k);
            }}
          >
            {v}
          </button>
        ))}
        <span className="tabs-gap" />
        <button className={view === "posted" ? "on" : ""} onClick={() => setView("posted")}>
          Posted ({counts.posted})
        </button>
        <button className={view === "archived" ? "on" : ""} onClick={() => setView("archived")}>
          Archived ({counts.archived})
        </button>
      </div>

      {shown.length === 0 && (
        <div className="empty">
          {view === "posted"
            ? i18next.t("notes.thoughtsYouPublishAs")
            : view === "archived"
              ? i18next.t("notes.nothingArchived")
              : i18next.t("notes.nothingHereYet")}
        </div>
      )}
      {shown.map((n) => (
        <div className="card" key={n.id}>
          {editing?.id === n.id ? (
            <>
              <div className="row" style={{ marginBottom: "var(--s-2)" }}>
                <select
                  value={editing.kind}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value })}
                  aria-label={i18next.t("notes.kind")}
                >
                  {Object.entries(KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  className="grow"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  aria-label={i18next.t("notes.title")}
                />
              </div>
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                aria-label={i18next.t("notes.text")}
              />
              <div className="row" style={{ marginTop: "var(--s-2)" }}>
                <button className="primary" onClick={saveEdit}>
                  {i18next.t("notes.save")}
                </button>
                <button className="ghost" onClick={() => setEditing(null)}>
                  {i18next.t("notes.cancel")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="row">
                <span className="chip">{KINDS[n.kind]}</span>
                {n.posted && <span className="chip posted">{i18next.t("notes.postedOnLinkedin")}</span>}
                {n.pinned && <span className="chip">{i18next.t("notes.pinned")}</span>}
                <span className="muted">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
              {n.title && <h2 style={{ marginTop: "var(--s-2)" }}>{n.title}</h2>}
              <div className="pre" style={{ marginTop: "var(--s-2)" }}>
                {n.body}
              </div>
              <div className="row" style={{ marginTop: "var(--s-3)" }}>
                {n.posted ? (
                  <Link className="btn" to="/posts/$id" params={{ id: String(n.postIds.at(-1)) }}>
                    {i18next.t("notes.viewThePost")}
                  </Link>
                ) : (
                  <button className="primary" onClick={() => toPost(n)}>
                    {n.postIds.length ? i18next.t("notes.continueThePost") : i18next.t("notes.makeLinkedinPost")}
                  </button>
                )}
                <button onClick={() => toTask(n)}>{i18next.t("notes.toTask")}</button>
                <More label={i18next.t("notes.more")} className="inline">
                  <button className="ghost" onClick={() => pin(n)}>
                    {n.pinned ? i18next.t("notes.unpin") : i18next.t("notes.pin")}
                  </button>
                  <button className="ghost" onClick={() => setEditing(n)}>
                    {i18next.t("notes.edit")}
                  </button>
                  <button className="ghost" onClick={() => archive(n)}>
                    {n.archived ? i18next.t("notes.unarchive") : i18next.t("notes.archive")}
                  </button>
                  <button className="ghost danger" onClick={() => remove(n)}>
                    {i18next.t("notes.delete")}
                  </button>
                </More>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}

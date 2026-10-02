import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { api, KINDS } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import More from "../../../components/More.tsx";
import type { Note } from "../../../types.ts";
import { useAddTask } from "../../tasks/index.ts";
import { useAddNote, useDeleteNote, useNotes, useUpdateNote } from "../api.ts";

export default function Notes() {
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
    if (confirm("Delete this for good?")) deleteNote.mutate(n.id);
  };
  const pin = (n: Note) => update.mutate({ id: n.id, change: { pinned: !n.pinned } });
  const archive = (n: Note) =>
    update.mutate(
      { id: n.id, change: { archived: !n.archived } },
      {
        onSuccess: () =>
          toast(n.archived ? "Moved back to your thoughts" : "Archived. It's kept under the Archived tab."),
      },
    );
  // a note that already has a post opens that post instead of making a second one
  const toPost = async (n: Note) => {
    if (n.postIds.length) return nav({ to: "/posts/$id", params: { id: String(n.postIds.at(-1)) } });
    const p = await api.post("/posts", { thought: n.body, noteId: n.id });
    nav({ to: "/posts/$id", params: { id: String(p.id) } });
  };
  const toTask = (n: Note) =>
    addTask.mutate({ title: n.title || n.body.slice(0, 80) }, { onSuccess: () => toast("Added to your tasks") });

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
      <h1>Thoughts & ideas</h1>
      <p className="sub">Write it down. Turn it into a post or a task whenever you like.</p>

      <div className="card">
        <textarea
          placeholder="Write it down…"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <button className="primary" disabled={!draft.body.trim() || addNote.isPending} onClick={add}>
            Add
          </button>
          <More label="Title and type" className="inline">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} aria-label="Kind">
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              placeholder="Title (optional)"
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
            ? "Thoughts you publish as posts will show up here."
            : view === "archived"
              ? "Nothing archived."
              : "Nothing here yet."}
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
                  aria-label="Kind"
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
                  aria-label="Title"
                />
              </div>
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                aria-label="Text"
              />
              <div className="row" style={{ marginTop: "var(--s-2)" }}>
                <button className="primary" onClick={saveEdit}>
                  Save
                </button>
                <button className="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="row">
                <span className="chip">{KINDS[n.kind]}</span>
                {n.posted && <span className="chip posted">Posted on LinkedIn</span>}
                {n.pinned && <span className="chip">Pinned</span>}
                <span className="muted">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
              {n.title && <h2 style={{ marginTop: "var(--s-2)" }}>{n.title}</h2>}
              <div className="pre" style={{ marginTop: "var(--s-2)" }}>
                {n.body}
              </div>
              <div className="row" style={{ marginTop: "var(--s-3)" }}>
                {n.posted ? (
                  <Link className="btn" to="/posts/$id" params={{ id: String(n.postIds.at(-1)) }}>
                    View the post
                  </Link>
                ) : (
                  <button className="primary" onClick={() => toPost(n)}>
                    {n.postIds.length ? "Continue the post" : "Make LinkedIn post"}
                  </button>
                )}
                <button onClick={() => toTask(n)}>To task</button>
                <More label="More" className="inline">
                  <button className="ghost" onClick={() => pin(n)}>
                    {n.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button className="ghost" onClick={() => setEditing(n)}>
                    Edit
                  </button>
                  <button className="ghost" onClick={() => archive(n)}>
                    {n.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button className="ghost danger" onClick={() => remove(n)}>
                    Delete
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

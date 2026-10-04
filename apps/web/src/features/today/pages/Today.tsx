import { useEffect, useRef, useState } from "react";
import { MyReminders } from "../../reminders/index.ts";
import { Link } from "@tanstack/react-router";
import { KINDS } from "../../../api.ts";
import { useApi, useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import FocusTimer from "../../../components/FocusTimer.tsx";
import More from "../../../components/More.tsx";
import { useAddNote, useNotes } from "../../notes/index.ts";
import { useProfile } from "../../profile/index.ts";
import { Welcome, useMe } from "../../account/index.ts";
import { useAddTask, useTasks, useUpdateTask } from "../../tasks/index.ts";
import type { OrganizedItem, Task } from "../../../types.ts";

/** Today as "YYYY-MM-DD" on this device's clock. */
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};


/** Someone new sees the welcome guide here first (P5-05); everyone else, their day. */
export default function Today() {
  const me = useMe().data;
  if (me && !me.onboarded) return <Welcome />;
  return <TodayPage />;
}

function TodayPage() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [kind, setKind] = useState("thought");
  const [sorted, setSorted] = useState<OrganizedItem[] | null>(null);
  // the same cached lists as the Tasks and Notes pages, so a change on either shows here at once
  const todayDay = localDay();
  const tasks = (useTasks().data ?? []).filter((t) => !t.done && (t.today || t.dueDay === todayDay));
  // what is on the calendar today: events and meetings (a repeating one shows on its days)
  const events = [...(useApi(`/calendar?from=${todayDay}&to=${todayDay}` as "/calendar", { meta: { silent: true } }).data?.events ?? [])]
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime));
  const recent = (useNotes().data ?? []).filter((n) => !n.archived && !n.posted).slice(0, 4);
  const addNote = useAddNote();
  const addTask = useAddTask();
  const update = useUpdateTask();
  const organize = useApiChange("post", "/ai/organize", { onSuccess: (r) => setSorted(r.items) });
  const busy = organize.isPending;

  const save = () =>
    addNote.mutate(
      { kind, body: text },
      {
        onSuccess: () => {
          setText("");
          toast("Saved. It's out of your head now 💜");
        },
      },
    );
  const sortIt = () => organize.mutate({ text });

  const saveSorted = async () => {
    if (!sorted) return;
    for (const it of sorted) {
      if (it.kind === "task") await addTask.mutateAsync({ title: it.title });
      else await addNote.mutateAsync({ kind: it.kind, title: it.title, body: it.body });
    }
    setSorted(null);
    setText("");
    toast(`Saved ${sorted.length} items`);
  };

  const complete = (t: Task) =>
    update.mutate({ id: t.id, change: { done: true } }, { onSuccess: () => toast("Done! 🎉") });

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Hey" : "Good evening";
  const first = (useProfile()?.name || "").trim().split(" ")[0];

  return (
    <>
      <h1>
        {hello}
        {first ? `, ${first}` : ""}
      </h1>
      <p className="sub">One thing at a time. Dump first, sort later.</p>
      <div className="row" style={{ marginBottom: "var(--s-3)" }}>
        <Link className="btn primary big" to="/study">📚 Study</Link>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Today</h2>
          {tasks.length === 0 && (
            <div className="empty">
              Nothing picked for today. <Link to="/tasks">Choose up to 3</Link>
            </div>
          )}
          {tasks.map((t) => (
            <div className="item" key={t.id}>
              <input type="checkbox" className="check" aria-label={`Done: ${t.title}`} onChange={() => complete(t)} />
              <div>{t.title}</div>
            </div>
          ))}
          <h3 style={{ marginTop: "var(--s-3)" }}>On your calendar today</h3>
          {events.length === 0 ? (
            <p className="muted">Nothing scheduled. <Link to="/calendar">Open the calendar</Link></p>
          ) : (
            <ul className="plain" aria-label="On your calendar today">
              {events.map((e) => (
                <li key={e.occId} className="item">
                  <span className="chip">{e.allDay ? "All day" : `${e.startTime}${e.endTime ? `–${e.endTime}` : ""}`}</span>
                  <div>{e.title}{e.location && <span className="muted"> · {e.location}</span>}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FocusTimer />
      </div>

      <MyReminders compact />

      <div className="card">
        <h2>Brain dump</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Whatever is in your head right now. Messy is fine."
        />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <button className="primary" disabled={!text.trim()} onClick={save}>
            Save
          </button>
        </div>
        <More label="More ways to save" className="in-card">
          <div className="row">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What kind of thing is this?">
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button disabled={!text.trim() || busy} onClick={sortIt}>
              {busy ? "Sorting…" : "Sort it for me (AI)"}
            </button>
          </div>
        </More>
        {sorted && (
          <div style={{ marginTop: "var(--s-4)" }}>
            <p className="muted">AI split it into {sorted.length} items. Save them all, or dismiss.</p>
            {sorted.map((it, i) => (
              <div className="item" key={i}>
                <span className="chip">{it.kind === "task" ? "✅ Task" : KINDS[it.kind] || it.kind}</span>
                <div>
                  <b>{it.title}</b>
                  <div className="muted">{it.body}</div>
                </div>
              </div>
            ))}
            <div className="row" style={{ marginTop: "var(--s-3)" }}>
              <button className="primary" onClick={saveSorted}>
                Save all
              </button>
              <button className="ghost" onClick={() => setSorted(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <More label="Recently saved" className="plain">
          {recent.length === 0 && <div className="empty">Nothing yet.</div>}
          {recent.map((n) => (
            <div className="item" key={n.id}>
              <span className="chip">{KINDS[n.kind]}</span>
              <div className="pre grow">
                {n.title && (
                  <b>
                    {n.title}
                    <br />
                  </b>
                )}
                {n.body.slice(0, 160)}
              </div>
            </div>
          ))}
        </More>
      </div>
    </>
  );
}

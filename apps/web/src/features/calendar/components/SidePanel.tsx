import { useState } from "react";
import type { Occurrence } from "../../../types.ts";
import { type DayInfo, type Upcoming, fmtClock, fmtDay, fmtMins, todayStr, addDays } from "./cal.ts";
import { studyMins } from "../../../api.ts";

// Right-hand panel: everything on the selected day, plus what's coming up.
type Props = {
  day: string; info: DayInfo | undefined; upcoming: Upcoming[];
  onShift: (dir: number) => void; onNew: (day: string) => void; onOpenEvent: (o: Occurrence) => void;
  onToggleTask: (t: DayInfo["tasks"][number]) => void; onMoveTask: (id: number, day: string) => void; onAddTask: (title: string) => void;
  onMoveGoal: (id: number, day: string) => void; onOpenStudy: () => void; onOpenPost: (id: number) => void; onPickDay: (day: string) => void;
};
export default function SidePanel({ day, info, upcoming, onShift, onNew, onOpenEvent, onToggleTask, onMoveTask, onAddTask, onMoveGoal, onOpenStudy, onOpenPost, onPickDay }: Props) {
  const [newTask, setNewTask] = useState("");
  const d: DayInfo = info || { events: [], tasks: [], goals: [], study: [], posts: [], studyMins: 0 };
  const empty = !d.events.length && !d.tasks.length && !d.goals.length && !d.study.length && !d.posts.length;
  const isToday = day === todayStr();
  const studied = d.study.reduce((t, s) => t + studyMins(s), 0);

  const add = () => { if (newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } };

  return (
    <aside className="cal-side">
      <div className="card side-card">
        <div className="row between">
          <div className="row" style={{ gap: "var(--s-1)" }}>
            <button className="ghost icon-btn" onClick={() => onShift(-1)} aria-label="Previous day">‹</button>
            <h2 className="side-title">{fmtDay(day)}</h2>
            <button className="ghost icon-btn" onClick={() => onShift(1)} aria-label="Next day">›</button>
          </div>
          {isToday && <span className="chip">Today</span>}
        </div>

        <div className="row" style={{ margin: "var(--s-2) 0 var(--s-1)" }}>
          <button className="primary" onClick={() => onNew(day)}>+ Event</button>
          {studied > 0 && <span className="muted tiny">Studied {fmtMins(studied)}</span>}
        </div>

        {empty && <p className="muted">A free day. Nothing planned.</p>}

        {d.events.length > 0 && (
          <section>
            <h3>Events</h3>
            {d.events.map((o) => (
              <button key={o.occId} className={`side-ev cat-${o.category}`} onClick={() => onOpenEvent(o)}>
                <span className="cat-bar" />
                <span className="grow">
                  <b>{o.title}</b>
                  <span className="muted tiny">
                    {o.allDay ? "All day" : `${o.startTime}${o.endTime ? ` – ${o.endTime}` : ""}`}
                    {o.location ? ` · ${o.location}` : ""}{o.repeat !== "none" ? " · repeats" : ""}
                  </span>
                </span>
              </button>
            ))}
          </section>
        )}

        <section>
          <h3>Tasks due</h3>
          {d.tasks.length === 0 && <p className="muted tiny">None.</p>}
          {d.tasks.map((t) => (
            <div className="side-task" key={t.id}>
              <input type="checkbox" className="check" checked={t.done} onChange={() => onToggleTask(t)} aria-label={`Done: ${t.title}`} />
              <span className={"grow" + (t.done ? " done" : "")}>{t.title}</span>
              <input type="date" className="mini-date" value={t.day} onChange={(e) => onMoveTask(t.id, e.target.value)} aria-label="Move to another day" />
            </div>
          ))}
          <div className="row" style={{ marginTop: "var(--s-2)", flexWrap: "nowrap" }}>
            <input className="grow" placeholder="New task for this day" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button disabled={!newTask.trim()} onClick={add}>Add</button>
          </div>
        </section>

        {d.goals.length > 0 && (
          <section>
            <h3>Goal deadlines</h3>
            {d.goals.map((g) => (
              <div className="side-task" key={g.id}>
                <span className="grow">{g.title}</span>
                <input type="date" className="mini-date" value={g.day} onChange={(e) => onMoveGoal(g.id, e.target.value)} aria-label="Move deadline" />
              </div>
            ))}
          </section>
        )}

        {d.study.length > 0 && (
          <section>
            <h3>Study</h3>
            {d.study.map((s) => (
              <button key={s.id} className="side-line" onClick={onOpenStudy}>
                {fmtClock(s.startedAt)}{s.endedAt ? ` – ${fmtClock(s.endedAt)}` : " – now"} · {fmtMins(studyMins(s))}
                <span className="muted tiny"> {s.course}{s.part ? ` / ${s.part}` : ""}</span>
              </button>
            ))}
          </section>
        )}

        {d.posts.length > 0 && (
          <section>
            <h3>LinkedIn posts</h3>
            {d.posts.map((p) => (
              <button key={p.id} className="side-line" onClick={() => onOpenPost(p.id)}>
                {p.status === "scheduled" ? "Goes live" : "Published"} {fmtClock(p.at)}
                <span className="muted tiny"> {p.title}</span>
              </button>
            ))}
          </section>
        )}
      </div>

      <div className="card side-card">
        <h2>Coming up</h2>
        {upcoming.length === 0 && <p className="muted tiny">Nothing in the next 7 days.</p>}
        {upcoming.map((u) => (
          <button key={u.key} className="up-row" onClick={() => onPickDay(u.day)}>
            <span className="up-day">{u.day === todayStr() ? "Today" : u.day === addDays(todayStr(), 1) ? "Tomorrow" : fmtDay(u.day, { weekday: "short", day: "numeric" })}</span>
            <span className={"up-dot " + u.cls} />
            <span className="grow up-text">{u.time ? <b>{u.time}</b> : null} {u.title}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

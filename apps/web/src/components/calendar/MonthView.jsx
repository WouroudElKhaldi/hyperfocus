import { fmtMins, parseDay } from "./cal.js";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 4;

// Month grid. `byDay[day]` holds what happens on each day (built by Calendar.jsx).
export default function MonthView({ days, month, byDay, today, selected, onSelect, onNew, onOpenEvent, onMoveEvent, onMoveTask }) {
  const drop = (e, day) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drop");
    try {
      const d = JSON.parse(e.dataTransfer.getData("application/x-cal"));
      if (d.type === "event") onMoveEvent(d, day);
      if (d.type === "task") onMoveTask(d.id, day);
    } catch { /* not one of ours */ }
  };
  const drag = (e, payload) => { e.dataTransfer.setData("application/x-cal", JSON.stringify(payload)); e.dataTransfer.effectAllowed = "move"; };

  return (
    <div className="mview">
      <div className="mhead">{WEEK.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="mgrid" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(112px, 1fr))` }}>
        {days.map((day) => {
          const d = byDay[day] || {};
          const dt = parseDay(day);
          const chips = [
            ...(d.goals || []).map((g) => ({ k: `g${g.id}`, cls: "goal", label: `Goal: ${g.title}`, title: g.title })),
            ...(d.events || []).map((o) => ({ k: o.occId, cls: `cat-${o.category} ev`, label: `${o.startTime && !o.allDay ? o.startTime + " " : ""}${o.title}`, title: o.title, ev: o })),
            ...(d.tasks || []).map((t) => ({ k: `t${t.id}`, cls: "task" + (t.done ? " done" : ""), label: t.title, title: t.title, task: t })),
            ...(d.posts || []).map((p) => ({ k: `p${p.id}`, cls: "post", label: p.status === "scheduled" ? "Post goes live" : "Post published", title: p.title })),
          ];
          const shown = chips.slice(0, d.studyMins ? MAX_CHIPS - 1 : MAX_CHIPS);
          const more = chips.length - shown.length;
          return (
            <div
              key={day}
              className={"mcell" + (dt.getMonth() !== month ? " other" : "") + (day === today ? " today" : "") + (day === selected ? " sel" : "")}
              onClick={() => onSelect(day)}
              onDoubleClick={() => onNew(day)}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drop")}
              onDrop={(e) => drop(e, day)}
            >
              <div className="mnum"><span>{dt.getDate()}</span></div>
              <div className="mchips">
                {shown.map((c) =>
                  c.ev ? (
                    <button key={c.k} className={"chipx " + c.cls} title={c.title + (c.ev.repeat !== "none" ? " (repeats)" : "")}
                      draggable={c.ev.repeat === "none"}
                      onDragStart={(e) => drag(e, { type: "event", id: c.ev.id, startTime: c.ev.startTime })}
                      onClick={(e) => { e.stopPropagation(); onOpenEvent(c.ev); }}>
                      {c.label}
                    </button>
                  ) : (
                    <div key={c.k} className={"chipx " + c.cls} title={c.title}
                      draggable={!!c.task}
                      onDragStart={c.task ? (e) => drag(e, { type: "task", id: c.task.id }) : undefined}>
                      {c.label}
                    </div>
                  ),
                )}
                {d.studyMins > 0 && <div className="chipx studylog" title="Study time logged">Studied {fmtMins(d.studyMins)}</div>}
                {more > 0 && <div className="more-chip">+{more} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

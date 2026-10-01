import { useEffect, useRef } from "react";
import { fmtClock, fmtHour, fmtMins, layoutLanes, minutesOfDate, parseDay, toMin, toTime } from "./cal.js";
import { studyMins } from "../../api.js";

const HOUR_H = 52;
const SNAP = 15;
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Week and day view: one column per day with hour rows. Events, study sessions and posts sit at their real times.
export default function TimeGrid({ days, byDay, today, selected, now, onSelect, onNewAt, onOpenEvent, onMoveEvent, onOpenStudy, onOpenPost }) {
  const scroller = useRef(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = days.includes(today) ? Math.max(0, minutesOfDate(now) / 60 - 2) : 7;
    el.scrollTop = focus * HOUR_H;
  }, [days.join(",")]);

  const yToMinutes = (e, step) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(1439, Math.max(0, Math.round(((e.clientY - rect.top) / HOUR_H) * 60 / step) * step));
  };

  const colItems = (day) => {
    const d = byDay[day] || {};
    const items = [];
    for (const o of d.events || []) {
      if (o.allDay || !o.startTime) continue;
      const s = toMin(o.startTime), e = o.endTime ? toMin(o.endTime) : s + 60;
      items.push({ key: o.occId, kind: "event", start: s, end: Math.max(e, s + 20), ev: o });
    }
    for (const s of d.study || []) {
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : s.pausedAt ? new Date(s.pausedAt) : now;
      const sm = minutesOfDate(start);
      const em = Math.max(sm + 15, Math.min(1439, sm + Math.round((end - start) / 60000)));
      items.push({ key: `s${s.id}`, kind: "study", start: sm, end: em, s });
    }
    for (const p of d.posts || []) {
      const at = new Date(p.at);
      const sm = minutesOfDate(at);
      items.push({ key: `p${p.id}`, kind: "post", start: sm, end: sm + 30, p });
    }
    return layoutLanes(items);
  };

  const dragStart = (e, o) => {
    e.dataTransfer.setData("application/x-cal", JSON.stringify({ type: "event", id: o.id, startTime: o.startTime, endTime: o.endTime }));
    e.dataTransfer.effectAllowed = "move";
  };
  const drop = (e, day) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drop");
    try {
      const d = JSON.parse(e.dataTransfer.getData("application/x-cal"));
      if (d.type === "event") onMoveEvent(d, day, toTime(yToMinutes(e, SNAP)));
    } catch { /* not one of ours */ }
  };

  const cols = `52px repeat(${days.length}, minmax(0, 1fr))`;
  const nowMin = minutesOfDate(now);

  return (
    <div className="tgrid">
      <div className="tg-head" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((day) => {
          const dt = parseDay(day);
          return (
            <button key={day} className={"tg-day" + (day === today ? " today" : "") + (day === selected ? " sel" : "")} onClick={() => onSelect(day)}>
              <span className="tg-dow">{WEEK[(dt.getDay() + 6) % 7]}</span>
              <span className="tg-date">{dt.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="tg-allday" style={{ gridTemplateColumns: cols }}>
        <div className="tg-gutter tiny muted">all day</div>
        {days.map((day) => {
          const d = byDay[day] || {};
          return (
            <div key={day} className="tg-allcell" onDoubleClick={() => onNewAt(day, "", "")}>
              {(d.goals || []).map((g) => <div key={`g${g.id}`} className="chipx goal" title={g.title}>Goal: {g.title}</div>)}
              {(d.events || []).filter((o) => o.allDay || !o.startTime).map((o) => (
                <button key={o.occId} className={`chipx ev cat-${o.category}`} onClick={() => onOpenEvent(o)} title={o.title}>{o.title}</button>
              ))}
              {(d.tasks || []).map((t) => <div key={`t${t.id}`} className={"chipx task" + (t.done ? " done" : "")} title="Task due">{t.title}</div>)}
            </div>
          );
        })}
      </div>

      <div className="tg-scroll" ref={scroller}>
        <div className="tg-body" style={{ gridTemplateColumns: cols, height: 24 * HOUR_H }}>
          <div className="tg-gutter-col">
            {Array.from({ length: 24 }, (_, h) => <div key={h} className="tg-hour-label" style={{ height: HOUR_H }}><span>{h ? fmtHour(h) : ""}</span></div>)}
          </div>
          {days.map((day) => (
            <div
              key={day}
              className={"tg-col" + (day === today ? " today" : "")}
              onClick={(e) => { if (e.target === e.currentTarget) { const m = Math.min(yToMinutes(e, 30), 1380); onNewAt(day, toTime(m), toTime(Math.min(1439, m + 60))); } }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drop")}
              onDrop={(e) => drop(e, day)}
            >
              {day === today && <div className="tg-now" style={{ top: (nowMin / 60) * HOUR_H }}><i /></div>}
              {colItems(day).map((it) => {
                const style = {
                  top: (it.start / 60) * HOUR_H,
                  height: Math.max(((it.end - it.start) / 60) * HOUR_H - 2, 20),
                  left: `calc(${(it.lane / it.lanes) * 100}% + 2px)`,
                  width: `calc(${100 / it.lanes}% - 4px)`,
                };
                if (it.kind === "event") {
                  const o = it.ev;
                  return (
                    <button key={it.key} className={`tg-item ev cat-${o.category}`} style={style}
                      draggable={o.repeat === "none"} onDragStart={(e) => dragStart(e, o)}
                      onClick={(e) => { e.stopPropagation(); onOpenEvent(o); }}
                      title={`${o.title}\n${o.startTime}${o.endTime ? " – " + o.endTime : ""}${o.location ? "\n" + o.location : ""}${o.repeat !== "none" ? "\n(repeats)" : ""}`}>
                      <b>{o.title}</b>
                      <span>{o.startTime}{o.endTime ? ` – ${o.endTime}` : ""}</span>
                    </button>
                  );
                }
                if (it.kind === "study") {
                  const s = it.s;
                  return (
                    <button key={it.key} className="tg-item studylog" style={style} onClick={(e) => { e.stopPropagation(); onOpenStudy(); }}
                      title={`Studied ${fmtMins(studyMins(s, now.getTime()))}${s.course ? "\n" + s.course : ""}${s.part ? " / " + s.part : ""}`}>
                      <b>Studied {fmtMins(studyMins(s, now.getTime()))}{!s.endedAt ? " (now)" : ""}</b>
                      <span>{fmtClock(s.startedAt)}{s.part ? ` · ${s.part}` : ""}</span>
                    </button>
                  );
                }
                return (
                  <button key={it.key} className="tg-item post" style={style} onClick={(e) => { e.stopPropagation(); onOpenPost(it.p.id); }} title={it.p.title}>
                    <b>{it.p.status === "scheduled" ? "Post goes live" : "Post published"}</b>
                    <span>{fmtClock(it.p.at)}</span>
                  </button>
                );
              })}
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="tg-hline" style={{ top: h * HOUR_H }} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

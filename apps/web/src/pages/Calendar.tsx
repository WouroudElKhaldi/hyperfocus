import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import More from "../components/More.tsx";
import { useNavigate } from "react-router-dom";
import { api, studyMins, errorOf } from "../api.ts";
import { useToast } from "../App.tsx";
import MonthView from "../components/calendar/MonthView.tsx";
import TimeGrid from "../components/calendar/TimeGrid.tsx";
import EventEditor from "../components/calendar/EventEditor.tsx";
import SidePanel from "../components/calendar/SidePanel.tsx";
import { type DayInfo, type EventForm, type MoveEvent, type Upcoming, addDays, blankEvent, fmtDay, monthGrid, parseDay, startOfWeek, todayStr, toMin, toTime, weekDays, ymd } from "../components/calendar/cal.ts";
import type { CalendarData, Occurrence, ParsedEvent, StudyBlock } from "../types.ts";

// Small helpers for remembering the view between visits (storage can be unavailable, so always guard it).
const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const LAYERS: [string, string][] = [["events", "Events"], ["tasks", "Tasks"], ["study", "Study log"], ["posts", "Posts"], ["goals", "Goals"]];
const localDayOf = (iso: string | null) => ymd(new Date(iso ?? 0));

export default function Calendar() {
  const toast = useToast();
  const nav = useNavigate();
  const [view, setView] = useState(() => read("cal-view", window.innerWidth < 720 ? "day" : "month"));
  const [anchor, setAnchor] = useState(todayStr());
  const [selected, setSelected] = useState(todayStr());
  const [layers, setLayers] = useState<Record<string, boolean>>(() => read("cal-layers", { events: true, tasks: true, study: true, posts: true, goals: true }));
  const [data, setData] = useState<CalendarData | null>(null);
  const [agenda, setAgenda] = useState<CalendarData | null>(null);
  const [editor, setEditor] = useState<EventForm | null>(null);
  const [quick, setQuick] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [plan, setPlan] = useState<{ blocks: StudyBlock[]; note: string } | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [now, setNow] = useState(new Date());

  const today = todayStr();
  const days = useMemo(() => (view === "month" ? monthGrid(anchor) : view === "week" ? weekDays(anchor) : [anchor]), [view, anchor]);

  const load = useCallback(() => {
    api.get<CalendarData>(`/calendar?from=${days[0]}&to=${days.at(-1)}`).then(setData).catch((e) => toast(e.message, "err"));
    api.get<CalendarData>(`/calendar?from=${todayStr()}&to=${addDays(todayStr(), 7)}`).then(setAgenda).catch(() => {});
  }, [days.join(",")]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { setNow(new Date()); load(); }, 60000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => write("cal-view", view), [view]);
  useEffect(() => write("cal-layers", layers), [layers]);

  // everything that happens on each visible day, filtered by the layer toggles
  const byDay = useMemo(() => {
    const m: Record<string, DayInfo> = {};
    const at = (k: string) => (m[k] ??= { events: [], tasks: [], goals: [], study: [], posts: [], studyMins: 0 });
    if (!data) return m;
    if (layers.events) data.events.forEach((o) => at(o.day).events.push(o));
    if (layers.tasks) data.tasks.forEach((t) => at(t.day).tasks.push(t));
    if (layers.goals) data.goals.forEach((g) => at(g.day).goals.push(g));
    if (layers.study) data.study.forEach((s) => { const d = at(localDayOf(s.startedAt)); d.study.push(s); d.studyMins += studyMins(s, now.getTime()); });
    if (layers.posts) data.posts.forEach((p) => at(localDayOf(p.at)).posts.push(p));
    return m;
  }, [data, layers, now]);

  const upcoming = useMemo(() => {
    if (!agenda) return [];
    const nowStr = `${todayStr()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const list: Upcoming[] = [
      ...agenda.events.map((o) => ({ key: o.occId, day: o.day, time: o.allDay ? "" : o.startTime, title: o.title, cls: `cat-${o.category}` })),
      ...agenda.tasks.filter((t) => !t.done).map((t) => ({ key: `t${t.id}`, day: t.day, time: "", title: t.title, cls: "task" })),
      ...agenda.goals.map((g) => ({ key: `g${g.id}`, day: g.day, time: "", title: `Goal deadline: ${g.title}`, cls: "goal" })),
      ...agenda.posts.filter((p) => p.status === "scheduled").map((p) => ({ key: `p${p.id}`, day: localDayOf(p.at), time: new Date(p.at ?? 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }), title: "LinkedIn post goes live", cls: "post" })),
    ];
    return list
      .filter((u) => u.day > todayStr() || `${u.day} ${u.time || "23:59"}` >= nowStr)
      .sort((a, b) => (a.day + (a.time || "00:00")).localeCompare(b.day + (b.time || "00:00")))
      .slice(0, 8);
  }, [agenda, now]);

  // ---------- navigation ----------
  const step = (dir: number) => {
    const d = parseDay(anchor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
    const next = ymd(d);
    setAnchor(next);
    if (view !== "month") setSelected(next);
  };
  const goToday = () => { setAnchor(today); setSelected(today); };
  const pickDay = (day: string) => {
    setSelected(day);
    if (view === "day") setAnchor(day);
    else if (view === "week" && startOfWeek(day) !== startOfWeek(anchor)) setAnchor(day);
    else if (view === "month" && day.slice(0, 7) !== anchor.slice(0, 7)) setAnchor(day);
  };
  const shiftSelected = (dir: number) => pickDay(addDays(selected, dir));
  const title = view === "month"
    ? parseDay(anchor).toLocaleDateString([], { month: "long", year: "numeric" })
    : view === "week"
      ? `${fmtDay(days[0] ?? anchor, { day: "numeric", month: "short" })} – ${fmtDay(days[6] ?? anchor, { day: "numeric", month: "short", year: "numeric" })}`
      : fmtDay(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ---------- events ----------
  const openNew = (day: string, startTime = "", endTime = "") => setEditor(blankEvent(day, startTime, endTime));
  const openEvent = (o: Occurrence) => setEditor({
    id: o.id, title: o.title, day: o.baseDay, occDay: o.day, allDay: o.allDay, startTime: o.startTime, endTime: o.endTime,
    category: o.category, repeat: o.repeat, repeatUntil: o.repeatUntil || "", location: o.location, notes: o.notes, remindMin: o.remindMin,
  });
  const saveEvent = async (form: EventForm) => {
    if (!editor) return;
    try {
      if (editor.id) await api.patch(`/events/${editor.id}`, form); else await api.post("/events", form);
      setEditor(null);
      toast(editor.id ? "Event updated" : "Event added");
      setSelected(form.day);
      load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const deleteEvent = async (scope: "day" | "all") => {
    if (!editor) return;
    try {
      if (scope === "day") await api.post(`/events/${editor.id}/skip`, { day: editor.occDay });
      else await api.del(`/events/${editor.id}`);
      setEditor(null);
      toast("Event deleted");
      load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const moveEvent = async (d: MoveEvent, day: string, startTime?: string) => {
    try {
      const body: { day: string; startTime?: string; endTime?: string } = { day };
      if (startTime && d.startTime) {
        const dur = d.endTime ? toMin(d.endTime) - toMin(d.startTime) : 60;
        body.startTime = startTime;
        body.endTime = toTime(Math.min(1439, toMin(startTime) + Math.max(dur, 15)));
      }
      await api.patch(`/events/${d.id}`, body);
      load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };

  // ---------- tasks and goals ----------
  const toggleTask = async (t: DayInfo["tasks"][number]) => { await api.patch(`/tasks/${t.id}`, { done: !t.done }); load(); };
  const moveTask = async (id: number, dueDay: string) => { await api.patch(`/tasks/${id}`, { dueDay: dueDay || null }); load(); };
  const addTask = async (titleText: string) => { await api.post("/tasks", { title: titleText, dueDay: selected }); load(); };
  const moveGoal = async (id: number, date: string) => { if (date) { await api.patch(`/goals/${id}`, { targetDate: date }); load(); } };

  // ---------- AI helpers ----------
  const quickAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!quick.trim()) return;
    setQuickBusy(true);
    try {
      const p = await api.post<ParsedEvent>("/calendar/parse", { text: quick });
      setEditor({ ...blankEvent(p.day, p.startTime, p.endTime), ...p, remindMin: p.startTime ? 10 : -1 });
      setQuick("");
    } catch (caught) { const err = errorOf(caught); toast(err.message, "err"); }
    setQuickBusy(false);
  };
  const makePlan = async () => {
    setPlanBusy(true);
    try { setPlan(await api.post<{ blocks: StudyBlock[]; note: string }>("/calendar/plan")); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setPlanBusy(false);
  };
  const addBlock = async (b: StudyBlock) => {
    try {
      await api.post("/events", { title: b.title, day: b.day, startTime: b.startTime, endTime: b.endTime, category: "study", remindMin: 10, notes: b.why });
      setPlan((p) => (p ? { ...p, blocks: p.blocks.filter((x) => x !== b) } : p));
      load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const addAllBlocks = async () => { for (const b of [...(plan?.blocks ?? [])]) await addBlock(b); toast("Study blocks added to your calendar"); setPlan(null); };

  const info = byDay[selected];

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="row tb-nav">
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous">‹</button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Next">›</button>
          <button onClick={goToday}>Today</button>
          <h1 className="cal-title">{title}</h1>
        </div>
        <div className="row tb-tools">
          <div className="seg" role="tablist" aria-label="Calendar view">
            {([["month", "Month"], ["week", "Week"], ["day", "Day"]] as [string, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => { setView(k); if (k !== "month") setAnchor(selected); }}>{l}</button>
            ))}
          </div>
          <button className="primary" onClick={() => openNew(selected)}>+ Event</button>
        </div>
      </div>

      <More label="Quick add, plan my week, export" open={window.innerWidth >= 900} className="cal-more">
      <div className="cal-bar2">
        <form className="quick" onSubmit={quickAdd}>
          <input id="quick-add" placeholder="Quick add: study Friday 3pm for 2h, dentist next Tuesday…" value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="Quick add an event in your own words" />
          <button disabled={!quick.trim() || quickBusy}>{quickBusy ? "Reading…" : "Add with AI"}</button>
        </form>
        <div className="row">
          <button onClick={makePlan} disabled={planBusy}>{planBusy ? "Planning…" : "Plan my study week"}</button>
          <a className="btn" href="/api/calendar.ics" download="thought-studio.ics" title="Import into Google Calendar, Apple Calendar or Outlook">Export .ics</a>
        </div>
      </div>

      </More>

      <More label="What to show" open={window.innerWidth >= 900} className="cal-more">
      <div className="layer-row" role="group" aria-label="What to show">
        {LAYERS.map(([k, l]) => (
          <button key={k} className={"layer-chip" + (layers[k] ? " on" : "")} aria-pressed={layers[k]} onClick={() => setLayers({ ...layers, [k]: !layers[k] })}>{l}</button>
        ))}
        <span className="legend">
          {["event", "study", "work", "personal", "health"].map((c) => <span key={c} className={`cat-${c}`}><i className="cat-dot" />{c === "event" ? "general" : c}</span>)}
        </span>
      </div>
      </More>

      <div className="cal-layout">
        <div className="card cal-main">
          {!data && <div className="empty">Loading your calendar…</div>}
          {data && view === "month" && (
            <MonthView days={days} month={parseDay(anchor).getMonth()} byDay={byDay} today={today} selected={selected}
              onSelect={pickDay} onNew={openNew} onOpenEvent={openEvent} onMoveEvent={moveEvent} onMoveTask={moveTask} />
          )}
          {data && view !== "month" && (
            <TimeGrid days={days} byDay={byDay} today={today} selected={selected} now={now}
              onSelect={pickDay} onNewAt={openNew} onOpenEvent={openEvent} onMoveEvent={moveEvent}
              onOpenStudy={() => nav("/study")} onOpenPost={(id) => nav(`/posts/${id}`)} />
          )}
        </div>
        <SidePanel day={selected} info={info} upcoming={upcoming} onShift={shiftSelected} onNew={openNew} onOpenEvent={openEvent}
          onToggleTask={toggleTask} onMoveTask={moveTask} onAddTask={addTask} onMoveGoal={moveGoal}
          onOpenStudy={() => nav("/study")} onOpenPost={(id) => nav(`/posts/${id}`)} onPickDay={pickDay} />
      </div>

      {editor && <EventEditor key={editor.id ?? "new"} value={editor} onSave={saveEvent} onCancel={() => setEditor(null)} onDelete={deleteEvent} />}

      {plan && (
        <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setPlan(null)}>
          <div className="modal card sheet">
            <div className="row between"><h2>Suggested study blocks</h2><button className="ghost icon-btn" onClick={() => setPlan(null)} aria-label="Close">✕</button></div>
            <p className="muted">Picked from your free time in the next 7 days, using your goals and skill gaps. Add the ones that feel doable.</p>
            {plan.blocks.length === 0 && <p className="muted">{plan.note || "Nothing left to suggest."}</p>}
            {plan.blocks.map((b) => (
              <div className="plan-row" key={b.day + b.startTime}>
                <div className="grow">
                  <b>{b.title}</b>
                  <div className="muted tiny">{fmtDay(b.day, { weekday: "short", day: "numeric", month: "short" })} · {b.startTime} – {b.endTime} ({b.minutes} min)</div>
                  <div className="muted tiny">{b.why}</div>
                </div>
                <button className="primary" onClick={() => addBlock(b)}>Add</button>
              </div>
            ))}
            {plan.blocks.length > 1 && <button onClick={addAllBlocks}>Add all</button>}
          </div>
        </div>
      )}
    </div>
  );
}

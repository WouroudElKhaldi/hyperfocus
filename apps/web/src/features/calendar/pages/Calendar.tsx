import { type FormEvent, useEffect, useMemo, useState } from "react";
import { dateLocale } from "../../../i18n/locale.ts";
import i18next from "i18next";
import More from "../../../components/More.tsx";
import { useNavigate } from "@tanstack/react-router";
import { studyMins } from "../../../api.ts";
import { useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import MonthView from "../components/MonthView.tsx";
import TimeGrid from "../components/TimeGrid.tsx";
import EventEditor from "../components/EventEditor.tsx";
import SidePanel from "../components/SidePanel.tsx";
import { useAddTask, useUpdateTask } from "../../tasks/index.ts";
import { useCalendar, useDeleteEvent, useMoveEvent, useMoveGoal, useSaveEvent } from "../api.ts";
import {
  type DayInfo,
  type EventForm,
  type MoveEvent,
  type Upcoming,
  addDays,
  blankEvent,
  CATEGORIES,
  fmtDay,
  monthGrid,
  parseDay,
  startOfWeek,
  todayStr,
  toMin,
  toTime,
  weekDays,
  ymd,
} from "../components/cal.ts";
import type { Occurrence, StudyBlock } from "../../../types.ts";

// Small helpers for remembering the view between visits (storage can be unavailable, so always guard it).
const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const LAYERS: [string, string][] = [
  ["events", "events"],
  ["tasks", "tasks"],
  ["study", "study"],
  ["posts", "posts"],
  ["goals", "goals"],
];
const localDayOf = (iso: string | null) => ymd(new Date(iso ?? 0));

export default function Calendar() {
  const toast = useToast();
  const nav = useNavigate();
  const [view, setView] = useState(() => read("cal-view", window.innerWidth < 720 ? "day" : "month"));
  const [anchor, setAnchor] = useState(todayStr());
  const [selected, setSelected] = useState(todayStr());
  const [layers, setLayers] = useState<Record<string, boolean>>(() =>
    read("cal-layers", { events: true, tasks: true, study: true, posts: true, goals: true }),
  );
  const [editor, setEditor] = useState<EventForm | null>(null);
  const [quick, setQuick] = useState("");
  const [plan, setPlan] = useState<{ blocks: StudyBlock[]; note: string } | null>(null);
  const [now, setNow] = useState(new Date());

  const today = todayStr();
  const days = useMemo(
    () => (view === "month" ? monthGrid(anchor) : view === "week" ? weekDays(anchor) : [anchor]),
    [view, anchor],
  );

  // the visible range, and the next 7 days for "Coming up" (both refresh every minute and after every change)
  const data = useCalendar(days[0] ?? anchor, days.at(-1) ?? anchor).data ?? null;
  const agenda = useCalendar(today, addDays(today, 7)).data ?? null;
  const saveEventChange = useSaveEvent();
  const deleteEventChange = useDeleteEvent();
  const moveEventChange = useMoveEvent();
  const moveGoalChange = useMoveGoal();
  const updateTask = useUpdateTask();
  const addTaskChange = useAddTask();
  const parse = useApiChange("post", "/calendar/parse");
  const planChange = useApiChange("post", "/calendar/plan", { onSuccess: setPlan });
  const addBlockChange = useApiChange("post", "/events", { refresh: ["/calendar"] });
  const quickBusy = parse.isPending;
  const planBusy = planChange.isPending;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
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
    if (layers.study)
      data.study.forEach((s) => {
        const d = at(localDayOf(s.startedAt));
        d.study.push(s);
        d.studyMins += studyMins(s, now.getTime());
      });
    if (layers.posts) data.posts.forEach((p) => at(localDayOf(p.at)).posts.push(p));
    return m;
  }, [data, layers, now]);

  const upcoming = useMemo(() => {
    if (!agenda) return [];
    const nowStr = `${todayStr()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const list: Upcoming[] = [
      ...agenda.events.map((o) => ({
        key: o.occId,
        day: o.day,
        time: o.allDay ? "" : o.startTime,
        title: o.title,
        cls: `cat-${o.category}`,
      })),
      ...agenda.tasks
        .filter((t) => !t.done)
        .map((t) => ({ key: `t${t.id}`, day: t.day, time: "", title: t.title, cls: "task" })),
      ...agenda.goals.map((g) => ({
        key: `g${g.id}`,
        day: g.day,
        time: "",
        title: i18next.t("cal.goalDeadline", { title: g.title }),
        cls: "goal",
      })),
      ...agenda.posts
        .filter((p) => p.status === "scheduled")
        .map((p) => ({
          key: `p${p.id}`,
          day: localDayOf(p.at),
          time: new Date(p.at ?? 0).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false }),
          title: i18next.t("cal.postLive"),
          cls: "post",
        })),
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
  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };
  const pickDay = (day: string) => {
    setSelected(day);
    if (view === "day") setAnchor(day);
    else if (view === "week" && startOfWeek(day) !== startOfWeek(anchor)) setAnchor(day);
    else if (view === "month" && day.slice(0, 7) !== anchor.slice(0, 7)) setAnchor(day);
  };
  const shiftSelected = (dir: number) => pickDay(addDays(selected, dir));
  const title =
    view === "month"
      ? parseDay(anchor).toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })
      : view === "week"
        ? `${fmtDay(days[0] ?? anchor, { day: "numeric", month: "short" })} – ${fmtDay(days[6] ?? anchor, { day: "numeric", month: "short", year: "numeric" })}`
        : fmtDay(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ---------- events ----------
  const openNew = (day: string, startTime = "", endTime = "") => setEditor(blankEvent(day, startTime, endTime));
  const openEvent = (o: Occurrence) =>
    setEditor({
      id: o.id,
      title: o.title,
      day: o.baseDay,
      occDay: o.day,
      allDay: o.allDay,
      startTime: o.startTime,
      endTime: o.endTime,
      category: o.category,
      repeat: o.repeat,
      repeatUntil: o.repeatUntil || "",
      location: o.location,
      notes: o.notes,
      remindMin: o.remindMin,
    });
  const saveEvent = (form: EventForm) => {
    if (!editor) return;
    saveEventChange.mutate(
      { id: editor.id, event: form },
      {
        onSuccess: () => {
          setEditor(null);
          toast(editor.id ? i18next.t("cal.updated") : i18next.t("cal.added"));
          setSelected(form.day);
        },
      },
    );
  };
  const deleteEvent = (scope: "day" | "all") => {
    if (!editor?.id) return;
    deleteEventChange.mutate(
      { id: editor.id, day: scope === "day" ? (editor.occDay ?? editor.day) : undefined },
      {
        onSuccess: () => {
          setEditor(null);
          toast(i18next.t("cal.deleted"));
        },
      },
    );
  };
  const moveEvent = (d: MoveEvent, day: string, startTime?: string) => {
    const change: { day: string; startTime?: string; endTime?: string } = { day };
    if (startTime && d.startTime) {
      const dur = d.endTime ? toMin(d.endTime) - toMin(d.startTime) : 60;
      change.startTime = startTime;
      change.endTime = toTime(Math.min(1439, toMin(startTime) + Math.max(dur, 15)));
    }
    moveEventChange.mutate({ id: d.id, change });
  };

  // ---------- tasks and goals ----------
  const toggleTask = (t: DayInfo["tasks"][number]) => updateTask.mutate({ id: t.id, change: { done: !t.done } });
  const moveTask = (id: number, dueDay: string) => updateTask.mutate({ id, change: { dueDay: dueDay || null } });
  const addTask = (titleText: string) => addTaskChange.mutate({ title: titleText, dueDay: selected });
  const moveGoal = (id: number, date: string) => {
    if (date) moveGoalChange.mutate({ id, targetDate: date });
  };

  // ---------- AI helpers ----------
  const quickAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!quick.trim()) return;
    parse.mutate(
      { text: quick },
      {
        onSuccess: (p) => {
          setEditor({ ...blankEvent(p.day, p.startTime, p.endTime), ...p, remindMin: p.startTime ? 10 : -1 });
          setQuick("");
        },
      },
    );
  };
  const makePlan = () => planChange.mutate(undefined);
  const addBlock = async (b: StudyBlock) => {
    await addBlockChange.mutateAsync({
      title: b.title,
      day: b.day,
      startTime: b.startTime,
      endTime: b.endTime,
      category: "study",
      remindMin: 10,
      notes: b.why,
    });
    setPlan((p) => (p ? { ...p, blocks: p.blocks.filter((x) => x !== b) } : p));
  };
  const addAllBlocks = async () => {
    try {
      for (const b of [...(plan?.blocks ?? [])]) await addBlock(b);
      toast(i18next.t("cal.blocksAdded"));
      setPlan(null);
    } catch {
      /* the error is already shown; the blocks not added yet stay in the list */
    }
  };

  const info = byDay[selected];

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="row tb-nav">
          <button className="icon-btn" onClick={() => step(-1)} aria-label={i18next.t("cal.previous")}>
            ‹
          </button>
          <button className="icon-btn" onClick={() => step(1)} aria-label={i18next.t("cal.next")}>
            ›
          </button>
          <button onClick={goToday}>{i18next.t("cal.today")}</button>
          <h1 className="cal-title">{title}</h1>
        </div>
        <div className="row tb-tools">
          <div className="seg" role="tablist" aria-label={i18next.t("cal.view")}>
            {(
              [
                ["month", i18next.t("cal.month")],
                ["week", i18next.t("cal.week")],
                ["day", i18next.t("cal.day")],
              ] as [string, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={view === k}
                className={view === k ? "on" : ""}
                onClick={() => {
                  setView(k);
                  if (k !== "month") setAnchor(selected);
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="primary" onClick={() => openNew(selected)}>
            {i18next.t("cal.newEvent")}
          </button>
        </div>
      </div>

      <More label={i18next.t("cal.tools")} open={window.innerWidth >= 900} className="cal-more">
        <div className="cal-bar2">
          <form className="quick" onSubmit={quickAdd}>
            <input
              id="quick-add"
              placeholder={i18next.t("cal.quickPlaceholder")}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              aria-label={i18next.t("cal.quickLabel")}
            />
            <button disabled={!quick.trim() || quickBusy}>{quickBusy ? i18next.t("cal.reading") : i18next.t("cal.addAi")}</button>
          </form>
          <div className="row">
            <button onClick={makePlan} disabled={planBusy}>
              {planBusy ? i18next.t("cal.planning") : i18next.t("cal.plan")}
            </button>
            <a
              className="btn"
              href="/api/calendar.ics"
              download="thought-studio.ics"
              title={i18next.t("cal.exportHint")}
            >
              {i18next.t("cal.export")}
            </a>
          </div>
        </div>
      </More>

      <More label={i18next.t("cal.show")} open={window.innerWidth >= 900} className="cal-more">
        <div className="layer-row" role="group" aria-label={i18next.t("cal.show")}>
          {LAYERS.map(([k, l]) => (
            <button
              key={k}
              className={"layer-chip" + (layers[k] ? " on" : "")}
              aria-pressed={layers[k]}
              onClick={() => setLayers({ ...layers, [k]: !layers[k] })}
            >
              {i18next.t(`cal.${l as "events"}`)}
            </button>
          ))}
          <span className="legend">
            {["event", "study", "work", "personal", "health"].map((c) => (
              <span key={c} className={`cat-${c}`}>
                <i className="cat-dot" />
                {CATEGORIES.find((x) => x.id === c)?.label ?? c}
              </span>
            ))}
          </span>
        </div>
      </More>

      <div className="cal-layout">
        <div className="card cal-main">
          {!data && <div className="empty">{i18next.t("cal.loading")}</div>}
          {data && view === "month" && (
            <MonthView
              days={days}
              month={parseDay(anchor).getMonth()}
              byDay={byDay}
              today={today}
              selected={selected}
              onSelect={pickDay}
              onNew={openNew}
              onOpenEvent={openEvent}
              onMoveEvent={moveEvent}
              onMoveTask={moveTask}
            />
          )}
          {data && view !== "month" && (
            <TimeGrid
              days={days}
              byDay={byDay}
              today={today}
              selected={selected}
              now={now}
              onSelect={pickDay}
              onNewAt={openNew}
              onOpenEvent={openEvent}
              onMoveEvent={moveEvent}
              onOpenStudy={() => nav({ to: "/study" })}
              onOpenPost={(id) => nav({ to: "/posts/$id", params: { id: String(id) } })}
            />
          )}
        </div>
        <SidePanel
          day={selected}
          info={info}
          upcoming={upcoming}
          onShift={shiftSelected}
          onNew={openNew}
          onOpenEvent={openEvent}
          onToggleTask={toggleTask}
          onMoveTask={moveTask}
          onAddTask={addTask}
          onMoveGoal={moveGoal}
          onOpenStudy={() => nav({ to: "/study" })}
          onOpenPost={(id) => nav({ to: "/posts/$id", params: { id: String(id) } })}
          onPickDay={pickDay}
        />
      </div>

      {editor && (
        <EventEditor
          key={editor.id ?? "new"}
          value={editor}
          onSave={saveEvent}
          onCancel={() => setEditor(null)}
          onDelete={deleteEvent}
        />
      )}

      {plan && (
        <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setPlan(null)}>
          <div className="modal card sheet">
            <div className="row between">
              <h2>{i18next.t("cal.suggested")}</h2>
              <button className="ghost icon-btn" onClick={() => setPlan(null)} aria-label={i18next.t("cal.close")}>
                ✕
              </button>
            </div>
            <p className="muted">
              Picked from your free time in the next 7 days, using your goals and skill gaps. Add the ones that feel
              doable.
            </p>
            {plan.blocks.length === 0 && <p className="muted">{plan.note || i18next.t("cal.nothingLeft")}</p>}
            {plan.blocks.map((b) => (
              <div className="plan-row" key={b.day + b.startTime}>
                <div className="grow">
                  <b>{b.title}</b>
                  <div className="muted tiny">
                    {fmtDay(b.day, { weekday: "short", day: "numeric", month: "short" })} · {b.startTime} – {b.endTime}{" "}
                    {i18next.t("cal.minutes", { n: b.minutes })}
                  </div>
                  <div className="muted tiny">{b.why}</div>
                </div>
                <button className="primary" onClick={() => addBlock(b)}>
                  {i18next.t("cal.add")}
                </button>
              </div>
            ))}
            {plan.blocks.length > 1 && <button onClick={addAllBlocks}>{i18next.t("cal.addAll")}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

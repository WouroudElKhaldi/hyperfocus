import { type FormEvent, useEffect, useRef, useState } from "react";
import i18next from "i18next";
import { CATEGORIES, type EventForm, REPEATS, REMINDERS, toMin, toTime } from "./cal.ts";

// Popup form for creating and editing an event. `value.id` is set when editing an existing one.
type Props = { value: EventForm; onSave: (form: EventForm) => void; onCancel: () => void; onDelete: (scope: "day" | "all") => void };
export default function EventEditor({ value, onSave, onCancel, onDelete }: Props) {
  const [f, setF] = useState(value);
  const [confirming, setConfirming] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const editing = !!value.id;
  const recurring = editing && value.repeat !== "none";

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = (patch: Partial<EventForm>) => setF((x) => ({ ...x, ...patch }));
  const setStart = (startTime: string) => {
    // keep the end 1 hour after the start unless the end is already later
    const endOk = f.endTime && startTime && toMin(f.endTime) > toMin(startTime);
    set({ startTime, endTime: endOk || !startTime ? f.endTime : toTime(Math.min(1439, toMin(startTime) + 60)), allDay: !startTime && f.allDay });
  };
  const valid = f.title.trim() && f.day && (f.allDay || !f.startTime || !f.endTime || toMin(f.endTime) > toMin(f.startTime));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      title: f.title.trim(), day: f.day, allDay: f.allDay || !f.startTime,
      startTime: f.allDay ? "" : f.startTime, endTime: f.allDay ? "" : f.endTime,
      category: f.category, repeat: f.repeat, repeatUntil: f.repeat === "none" ? "" : f.repeatUntil,
      location: f.location, notes: f.notes, remindMin: f.allDay || !f.startTime ? -1 : Number(f.remindMin),
    });
  };

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal card sheet" onSubmit={submit} aria-label={editing ? i18next.t("cal.editEvent") : i18next.t("cal.newEventTitle")}>
        <div className="row between">
          <h2>{editing ? i18next.t("cal.editEvent") : i18next.t("cal.newEventTitle")}</h2>
          <button type="button" className="ghost icon-btn" onClick={onCancel} aria-label={i18next.t("cal.close")}>✕</button>
        </div>

        <input ref={titleRef} id="ev-title" className="ev-title" placeholder={i18next.t("cal.eventTitle")} value={f.title} onChange={(e) => set({ title: e.target.value })} />

        <div className="cat-pick" role="radiogroup" aria-label={i18next.t("cal.category")}>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={f.category === c.id} className={`cat-chip cat-${c.id}` + (f.category === c.id ? " on" : "")} onClick={() => set({ category: c.id })}>
              <span className="cat-dot" /> {c.label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label>{i18next.t("cal.date")}<input id="ev-day" type="date" value={f.day} onChange={(e) => set({ day: e.target.value })} /></label>
          <label className="check-row">
            <input id="ev-allday" type="checkbox" className="check" checked={f.allDay} onChange={(e) => set({ allDay: e.target.checked, startTime: e.target.checked ? "" : f.startTime || "09:00", endTime: e.target.checked ? "" : f.endTime || "10:00" })} />
            {i18next.t("cal.allDay")}
          </label>
          {!f.allDay && (
            <>
              <label>{i18next.t("cal.starts")}<input id="ev-start" type="time" value={f.startTime} onChange={(e) => setStart(e.target.value)} /></label>
              <label>{i18next.t("cal.ends")}<input id="ev-end" type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></label>
            </>
          )}
          <label>{i18next.t("cal.repeat")}
            <select id="ev-repeat" value={f.repeat} onChange={(e) => set({ repeat: e.target.value })}>
              {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          {f.repeat !== "none" && (
            <label>{i18next.t("cal.until")}<input id="ev-until" type="date" value={f.repeatUntil} min={f.day} onChange={(e) => set({ repeatUntil: e.target.value })} /></label>
          )}
          {!f.allDay && (
            <label>{i18next.t("cal.reminder")}
              <select id="ev-remind" value={f.remindMin} onChange={(e) => set({ remindMin: Number(e.target.value) })}>
                {REMINDERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
          )}
        </div>

        <label>{i18next.t("cal.where")}<input id="ev-loc" placeholder={i18next.t("cal.wherePlaceholder")} value={f.location} onChange={(e) => set({ location: e.target.value })} /></label>
        <label>{i18next.t("cal.notes")}<textarea id="ev-notes" rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
        {f.remindMin >= 0 && !f.allDay && <p className="muted tiny">{i18next.t("cal.remindNote")}</p>}

        <div className="row between wrap">
          <div className="row">
            <button type="submit" className="primary" disabled={!valid}>{editing ? i18next.t("cal.saveChanges") : i18next.t("cal.addEvent")}</button>
            <button type="button" className="ghost" onClick={onCancel}>{i18next.t("cal.cancel")}</button>
          </div>
          {editing && !confirming && <button type="button" className="ghost danger" onClick={() => (recurring ? setConfirming(true) : onDelete("all"))}>{i18next.t("cal.delete")}</button>}
          {editing && confirming && (
            <div className="row">
              <button type="button" className="danger-btn" onClick={() => onDelete("day")}>{i18next.t("cal.onlyDay")}</button>
              <button type="button" className="danger-btn" onClick={() => onDelete("all")}>{i18next.t("cal.wholeSeries")}</button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

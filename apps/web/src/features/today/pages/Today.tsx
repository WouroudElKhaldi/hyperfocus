import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MyReminders } from "../../reminders/index.ts";
import { Link } from "@tanstack/react-router";
import { KINDS } from "../../../api.ts";
import { useApi, useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import { aboutMeOf, saidAnything } from "../../../components/AboutMe.tsx";
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

const NUDGE_OFF = "aboutme-nudge-off";

/** P5-14: for someone who skipped the welcome guide (or its questions): one quiet card asking about them, until they
 * answer anything in Profile or close it. */
function AboutMeNudge() {
  const { t } = useTranslation();
  const profile = useProfile();
  const [off, setOff] = useState(() => { try { return localStorage.getItem(NUDGE_OFF) === "1"; } catch { return false; } });
  if (off || !profile || saidAnything(aboutMeOf(profile))) return null;
  const close = () => { setOff(true); try { localStorage.setItem(NUDGE_OFF, "1"); } catch { /* shown again next time */ } };
  return (
    <section className="card aboutme-nudge" aria-labelledby="aboutme-nudge-h">
      <h2 id="aboutme-nudge-h">{t("aboutme.nudgeTitle")}</h2>
      <p className="muted">{t("aboutme.nudgeBody")}</p>
      <div className="row">
        <Link className="btn primary" to="/profile" hash="about-me">{t("aboutme.nudgeGo")}</Link>
        <button type="button" className="ghost" onClick={close}>{t("aboutme.nudgeLater")}</button>
      </div>
    </section>
  );
}

function TodayPage() {
  const toast = useToast();
  const { t } = useTranslation();
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
          toast(t("today.savedToast"));
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
    toast(t("today.savedMany", { count: sorted.length }));
  };

  const complete = (task: Task) =>
    update.mutate({ id: task.id, change: { done: true } }, { onSuccess: () => toast(t("today.doneToast")) });

  const hour = new Date().getHours();
  const hello = t(`today.hello.${hour < 12 ? "morning" : hour < 18 ? "day" : "evening"}`);
  const first = (useProfile()?.name || "").trim().split(" ")[0];

  return (
    <>
      <h1>{first ? t("today.helloName", { hello, name: first }) : hello}</h1>
      <p className="sub">{t("today.sub")}</p>
      <div className="row" style={{ marginBottom: "var(--s-3)" }}>
        <Link className="btn primary big" to="/study">{t("today.study")}</Link>
      </div>
      <AboutMeNudge />

      <div className="grid2">
        <div className="card">
          <h2>{t("today.card")}</h2>
          {tasks.length === 0 && (
            <div className="empty">
              {t("today.none")} <Link to="/tasks">{t("today.choose")}</Link>
            </div>
          )}
          {tasks.map((task) => (
            <div className="item" key={task.id}>
              <input type="checkbox" className="check" aria-label={t("today.doneLabel", { title: task.title })} onChange={() => complete(task)} />
              <div>{task.title}</div>
            </div>
          ))}
          <h3 style={{ marginTop: "var(--s-3)" }}>{t("today.calendar")}</h3>
          {events.length === 0 ? (
            <p className="muted">{t("today.nothing")} <Link to="/calendar">{t("today.openCalendar")}</Link></p>
          ) : (
            <ul className="plain" aria-label={t("today.calendar")}>
              {events.map((e) => (
                <li key={e.occId} className="item">
                  <span className="chip">{e.allDay ? t("today.allDay") : `${e.startTime}${e.endTime ? `–${e.endTime}` : ""}`}</span>
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
        <h2>{t("today.dump")}</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("today.dumpPlaceholder")}
        />
        <div className="row" style={{ marginTop: "var(--s-3)" }}>
          <button className="primary" disabled={!text.trim()} onClick={save}>
            {t("today.save")}
          </button>
        </div>
        <More label={t("today.moreWays")} className="in-card">
          <div className="row">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("today.kindLabel")}>
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button disabled={!text.trim() || busy} onClick={sortIt}>
              {busy ? t("today.sorting") : t("today.sort")}
            </button>
          </div>
        </More>
        {sorted && (
          <div style={{ marginTop: "var(--s-4)" }}>
            <p className="muted">{t("today.split", { count: sorted.length })}</p>
            {sorted.map((it, i) => (
              <div className="item" key={i}>
                <span className="chip">{it.kind === "task" ? t("today.task") : KINDS[it.kind] || it.kind}</span>
                <div>
                  <b>{it.title}</b>
                  <div className="muted">{it.body}</div>
                </div>
              </div>
            ))}
            <div className="row" style={{ marginTop: "var(--s-3)" }}>
              <button className="primary" onClick={saveSorted}>
                {t("today.saveAll")}
              </button>
              <button className="ghost" onClick={() => setSorted(null)}>
                {t("today.dismiss")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <More label={t("today.recent")} className="plain">
          {recent.length === 0 && <div className="empty">{t("today.nothingYet")}</div>}
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

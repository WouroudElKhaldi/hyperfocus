import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import More from "../../../components/More.tsx";
import { useNavigate } from "@tanstack/react-router";
import { api } from "../../../api.ts";
import { useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import type { Review as ReviewData } from "../../../types.ts";
import { useAddTask } from "../../tasks/index.ts";
import { useDeleteReview, useReviews } from "../api.ts";

const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);
const when = (d: string) => new Date(d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card stat">
      <div className="muted">{label}</div>
      <div className="big-num">{value}</div>
      {sub && <div className="muted tiny">{sub}</div>}
    </div>
  );
}

export default function Review() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const nav = useNavigate();
  const reviews = useReviews().data ?? [];
  // the one picked in the list; the newest when none is picked (or the picked one was deleted)
  const [pickedId, setPickedId] = useState<number | null>(null);
  const current = reviews.find((r) => r.id === pickedId) ?? reviews[0] ?? null;
  const write = useApiChange("post", "/reviews", { refresh: ["/reviews"], onSuccess: (r) => setPickedId(r.id) });
  const deleteReview = useDeleteReview();
  const addTaskChange = useAddTask();
  const busy = write.isPending;

  const generate = () => write.mutate(undefined);
  const remove = (r: ReviewData) => { if (confirm(i18next.t("review.deleteThisReview2"))) deleteReview.mutate(r.id); };
  const addTask = (title: string) => addTaskChange.mutate({ title }, { onSuccess: () => toast(i18next.t("review.addedToYourTasks")) });
  const addAll = async () => {
    if (!current) return;
    for (const p of current.content.priorities) await addTaskChange.mutateAsync({ title: p.title });
    toast(i18next.t("review.your3PrioritiesAre"));
  };
  const toPost = async () => {
    if (!current) return;
    const p = await api.post("/posts", { thought: current.content.postIdea });
    nav({ to: "/posts/$id", params: { id: String(p.id) } });
  };

  const c = current?.content, s = current?.stats;
  const diff = s ? s.studyMinutes - s.studyMinutesLastWeek : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{i18next.t("review.weeklyReview")}</h1>
          <p className="sub">{i18next.t("review.theLast7Days")}</p>
        </div>
        <button className="primary big" disabled={busy} onClick={generate}>{busy ? i18next.t("review.writingYourReview") : i18next.t("review.reviewMyWeek")}</button>
      </div>

      {!current && !busy && <div className="empty">{i18next.t("review.noReviewYetPress")}</div>}

      {current && c && s && (
        <>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Review of {current.label} · made {when(current.createdAt)}</span>
            {reviews.length > 1 && (
              <select value={current.id} onChange={(e) => setPickedId(Number(e.target.value))}>
                {reviews.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            )}
          </div>

          <div className="card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: 0 }}>{c.headline}</h2>
          </div>

          <div className="card plain-more">
          <More label={i18next.t("review.theNumbers")} open>
          <div className="stats">
            <Stat label={i18next.t("review.studyTime")} value={hm(s.studyMinutes)} sub={s.studyMinutesLastWeek || s.studyMinutes ? `${diff >= 0 ? "+" : "−"}${hm(Math.abs(diff))} vs the week before` : ""} />
            <Stat label={i18next.t("review.studyDays")} value={`${s.studyDays} / 7`} sub={s.studySessions === 1 ? i18next.t("review.oneSession") : i18next.t("review.sessions", { count: s.studySessions })} />
            <Stat label={i18next.t("review.tasksDone")} value={s.tasksDone} sub={s.tasksOverdue ? i18next.t("review.waitingBefore", { count: s.tasksOverdue }) : i18next.t("review.open", { count: s.tasksOpen })} />
            <Stat label={i18next.t("review.postsPublished")} value={s.postsPublished} sub={s.draftsWaiting === 1 ? i18next.t("review.oneDraft") : i18next.t("review.draftsWaiting", { count: s.draftsWaiting })} />
          </div>
          </More>
          </div>

          <div className="grid2">
            <div className="card">
              <h2>{i18next.t("review.wins")}</h2>
              {c.wins.map((w, i) => <p key={i} style={{ margin: "var(--s-1) 0" }}>• {w}</p>)}
            </div>
            <div className="card">
              <h2>{i18next.t("review.gentlyNoticing")}</h2>
              {c.watch.length === 0 && <p className="muted">{i18next.t("review.nothingWorryingKeepGoing")}</p>}
              {c.watch.map((w, i) => <p key={i} style={{ margin: "var(--s-1) 0" }}>• {w}</p>)}
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{i18next.t("review.nextWeekJustThese")}</h2>
              {c.priorities.length > 0 && <button onClick={addAll}>{i18next.t("review.addAllToTasks")}</button>}
            </div>
            {c.priorities.map((p, i) => (
              <div className="item" key={i}>
                <b style={{ width: 18 }}>{i + 1}.</b>
                <div className="grow"><b>{p.title}</b><div className="muted">{p.why}</div></div>
                <button className="ghost" onClick={() => addTask(p.title)}>{i18next.t("review.task")}</button>
              </div>
            ))}
            {c.tinyStart && <div className="break-note" style={{ marginTop: "var(--s-3)" }}>⚡ Tiny start for #1 (under 2 minutes): {c.tinyStart}</div>}
          </div>

          {c.postIdea && (
            <div className="card">
              <h2>{i18next.t("review.aPostIdeaFrom")}</h2>
              <p className="pre">{c.postIdea}</p>
              <button className="primary" onClick={toPost}>{i18next.t("review.turnItIntoA")}</button>
            </div>
          )}

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="ghost" onClick={() => remove(current)}>{i18next.t("review.deleteThisReview")}</button>
          </div>
        </>
      )}
    </>
  );
}

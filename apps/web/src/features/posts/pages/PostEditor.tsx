import { useEffect, useRef, useState } from "react";
import { dateLocale } from "../../../i18n/locale.ts";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "@tanstack/react-router";
import { api, errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import LoadProblem, { isId, notFound } from "../../../components/LoadProblem.tsx";
import type { PolishResult, Post, RewriteResult } from "../../../types.ts";
import { useDeletePost, usePost, usePostStatus } from "../api.ts";

const LIMIT = 3000;
const QUICK = ["quick1", "quick2", "quick3", "quick4", "quick5"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (at: string | number | Date) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const tomorrowAt = (h: number) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
const fmtWhen = (d: string | null) => new Date(d ?? 0).toLocaleString(dateLocale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, "sDraft" | "sScheduled" | "sPosting" | "sPosted" | "sFailed" | "sMissed"> = { draft: "sDraft", scheduled: "sScheduled", posting: "sPosting", posted: "sPosted", failed: "sFailed", missed: "sMissed" };

// Top-level so the date input keeps focus while the editor re-renders.
type ScheduleProps = { post: Post; blockedReason: string; status: ReturnType<typeof usePostStatus> };
function Schedule({ post, blockedReason, status }: ScheduleProps) {
  const toast = useToast();
  const { t } = useTranslation();
  const [when, setWhen] = useState(() => toLocalInput(post.status === "scheduled" && post.scheduledAt ? post.scheduledAt : tomorrowAt(9)));
  const [changing, setChanging] = useState(false);
  const busy = status.schedule.isPending;

  // the latest text is saved first, so what gets posted is what you see
  const schedule = () => {
    if (!when || Number.isNaN(new Date(when).getTime())) return toast(t("posts.pickTime"), "err");
    status.schedule.mutate(new Date(when).toISOString(), {
      onSuccess: () => { setChanging(false); toast(t("posts.scheduledToast")); },
    });
  };
  const cancel = () => status.unschedule.mutate(undefined, { onSuccess: () => toast(t("posts.unscheduled")) });

  if (post.status === "posted") return null;

  const picker = (
    <div className="row" style={{ marginTop: "var(--s-2)" }}>
      <input type="datetime-local" style={{ width: "auto" }} value={when} onChange={(e) => setWhen(e.target.value)} />
      <button className="ghost" onClick={() => setWhen(toLocalInput(Date.now() + 3600000))}>{t("posts.in1h")}</button>
      <button className="ghost" onClick={() => setWhen(toLocalInput(tomorrowAt(9)))}>{t("posts.tomorrow9")}</button>
      <button className="primary" disabled={busy} onClick={schedule}>{busy ? t("posts.saving") : t("posts.schedule")}</button>
      {changing && <button className="ghost" onClick={() => setChanging(false)}>{t("posts.cancel")}</button>}
    </div>
  );

  if (post.status === "scheduled" || post.status === "posting") {
    return (
      <div className="verdict v-ok" style={{ marginTop: "var(--s-4)" }}>
        <b>{post.status === "posting" ? t("posts.sending") : t("posts.scheduledFor", { when: fmtWhen(post.scheduledAt) })}</b>
        {post.status === "scheduled" && (
          <>
            <p>{t("posts.autoNote")}
              {post.attempts > 0 && <> {t("posts.lastTry", { n: post.attempts, error: post.lastError })}</>}</p>
            {changing ? picker : (
              <div className="row">
                <button className="ghost" onClick={() => setChanging(true)}>{t("posts.changeTime")}</button>
                <button className="ghost" onClick={cancel}>{t("posts.cancelSchedule")}</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="schedule-box" style={{ marginTop: "var(--s-4)" }}>
      {(post.status === "failed" || post.status === "missed") && (
        <div className="verdict v-bad" style={{ marginBottom: "var(--s-3)" }}>
          <b>{post.status === "missed" ? t("posts.notOnTime") : t("posts.autoFailed")}</b>
          <p className="pre">{post.lastError}</p>
        </div>
      )}
      <b>{t("posts.scheduleIt")}</b> <span className="muted">{t("posts.scheduleHint")}</span>
      {blockedReason ? <p className="muted" style={{ marginTop: "var(--s-2)" }}>{blockedReason}</p> : picker}
    </div>
  );
}

export default function PostEditor() {
  const { id } = useParams({ from: "/posts/$id" });
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const [thought, setThought] = useState("");
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [changes, setChanges] = useState<string[]>([]);
  const [thoughtHistory, setThoughtHistory] = useState<string[]>([]);
  const [hooks, setHooks] = useState<string[]>([]);
  const [hookType, setHookType] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const loaded = useRef(false);
  // while it is scheduled or being sent, the post looks again every 15 s (only its status shows; your text stays yours)
  const [live, setLive] = useState(false);
  const postQuery = usePost(id, live);
  const post = postQuery.data ?? null;
  const loadErr = !isId(id) ? notFound : postQuery.error ? errorOf(postQuery.error) : null;
  const status = usePostStatus(Number(id), () => ({ thought, draft }));
  const deletePost = useDeletePost();

  // the text is filled in once, when the post first loads
  useEffect(() => {
    if (!post) return;
    setThought(post.thought); setDraft(post.draft);
    setTimeout(() => (loaded.current = true), 0);
  }, [post?.id]);

  const lastStatus = useRef(post?.status);
  useEffect(() => {
    if (!post) return;
    setLive(["scheduled", "posting"].includes(post.status));
    if (post.status === "posted" && lastStatus.current && ["scheduled", "posting"].includes(lastStatus.current))
      toast(t("posts.wentLive"));
    lastStatus.current = post.status;
  }, [post?.status]);

  // autosave 800ms after typing stops
  useEffect(() => {
    if (!loaded.current) return;
    setSaved(false);
    const timer = setTimeout(() => {
      api.patch(`/posts/${id}`, { thought, draft }).then(() => setSaved(true)).catch((e) => toast(e.message, "err"));
    }, 800);
    return () => clearTimeout(timer);
  }, [thought, draft]);

  const applyAI = async (instr?: string) => {
    setBusy(true);
    try {
      const out = await api.post("/ai/rewrite", instr ? { thought, draft, instruction: instr } : { thought });
      setHistory((h) => [...h, draft]);
      setDraft(out.draft);
      setSuggestions(out.suggestions);
      setChanges([]);
      if (!instr || out.hooks?.length) { setHooks(out.hooks || []); setHookType(out.hookType || ""); }
      setInstruction("");
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };

  const polish = async () => {
    setBusy(true);
    try {
      // cleans the thought itself (tiny fixes only) BEFORE generating a post; the previous text is kept for undo
      const out = await api.post("/ai/polish", { text: thought });
      if (out.draft === thought) toast(t("posts.alreadyClean"));
      else { setThoughtHistory((h) => [...h, thought]); setThought(out.draft); }
      setChanges(out.changes);
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };

  const undoThought = () => {
    const last = thoughtHistory.at(-1);
    if (last === undefined) return;
    setThought(last);
    setThoughtHistory((h) => h.slice(0, -1));
    setChanges([]);
  };

  const undo = () => { const last = history.at(-1); if (last === undefined) return; setDraft(last); setHistory((h) => h.slice(0, -1)); };

  // LinkedIn's API can't create real tags, so posts with an @mention are finished on linkedin.com
  const hasMention = /(^|\s)@[\p{L}\d_]/u.test(draft);

  const publish = async () => {
    if (hasMention) {
      await navigator.clipboard.writeText(draft).catch(() => {});
      window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank");
      toast(t("posts.mentionCopied"));
      return;
    }
    if (!confirm(t("posts.postNow"))) return;
    status.publish.mutate(undefined, {
      onSuccess: () => toast(t("posts.postedToast")),
      onError: (caught) => {
        const e = errorOf(caught);
        if (e.code === "n8n_not_configured") {
          navigator.clipboard.writeText(draft).catch(() => {});
          window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank");
          toast(t("posts.noN8n"));
        } else toast(e.message, "err");
      },
    });
  };

  const markPosted = () => status.markPosted.mutate();
  const remove = () => { if (confirm(t("posts.deleteAsk"))) deletePost.mutate(Number(id), { onSuccess: () => nav({ to: "/posts" }) }); };

  if (loadErr) return <LoadProblem error={loadErr} what="post" back="/posts" backLabel={t("posts.backToPosts")} onRetry={() => postQuery.refetch()} />;
  if (!post) return <p className="muted">{t("posts.loading")}</p>;
  const posted = post.status === "posted";

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{t("posts.editor")}</h1>
          <p className="sub">
            <span className={"chip " + post.status}>{STATUS[post.status] ? t(`posts.${STATUS[post.status] as "sDraft"}`) : post.status}</span>{" "}
            {saved ? t("posts.saved") : t("posts.saving")}
          </p>
        </div>
        <button className="ghost" onClick={remove}>{t("posts.delete")}</button>
      </div>

      <div className="grid2 editor">
        <div className="card">
          <h2>{t("posts.thought")}</h2>
          <textarea value={thought} onChange={(e) => setThought(e.target.value)} placeholder={t("posts.thoughtPlaceholder")} />
          <p className="muted">{t("posts.thoughtNote")}</p>
          <div className="row">
            <button className="primary" disabled={busy || !thought.trim()} onClick={() => applyAI()} title={t("posts.rewriteHint")}>
              {busy ? t("posts.working") : draft.trim() ? t("posts.rewrite") : t("posts.turn")}
            </button>
            <button disabled={busy || !thought.trim()} onClick={polish} title={t("posts.polishHint")}>
              {busy ? t("posts.working") : t("posts.polish")}
            </button>
            <button className="ghost" disabled={!thoughtHistory.length} onClick={undoThought}>{t("posts.undoPolish")}</button>
          </div>
          {changes.length > 0 && (
            <div className="hookbox" style={{ marginTop: "var(--s-3)" }}>
              <b>{t("posts.polishFixed")}</b> {changes.join(" · ")}
            </div>
          )}
        </div>

        <div className="card">
          <h2>{t("posts.draft")}</h2>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("posts.draftPlaceholder")} />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">{hookType && t("posts.hookStyle", { style: hookType })}</span>
            <div className={"count" + (draft.length > LIMIT ? " over" : "")}>{draft.length} / {LIMIT}</div>
          </div>
          {draft && (
            <div className="hookbox">
              <b>{t("posts.seeMoreLabel")}</b> <span className="pre">{draft.slice(0, 140)}{draft.length > 140 && <span className="muted">{t("posts.seeMore")}</span>}</span>
            </div>
          )}
          {hooks.length > 0 && (
            <>
              <p className="muted" style={{ marginTop: "var(--s-3)" }}>{t("posts.otherHooks")}</p>
              <div className="sugg">
                {hooks.map((h, i) => (
                  <button key={i} disabled={busy} onClick={() => applyAI(`Replace ONLY the opening hook with exactly this line, and adjust the following line so it flows: "${h}"`)}>🪝 {h}</button>
                ))}
              </div>
            </>
          )}

          <div className="row" style={{ marginTop: "var(--s-2)" }}>
            <input className="grow" placeholder={t("posts.askAi")} value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && instruction.trim() && draft.trim() && applyAI(instruction)} />
            <button disabled={busy || !instruction.trim() || !draft.trim()} onClick={() => applyAI(instruction)}>{t("posts.edit")}</button>
          </div>
          <div className="sugg">
            {QUICK.map((q) => <button key={q} disabled={busy || !draft.trim()} onClick={() => applyAI(t(`posts.${q}`))}>{t(`posts.${q}`)}</button>)}
          </div>
          {suggestions.length > 0 && (
            <>
              <p className="muted" style={{ marginTop: "var(--s-4)" }}>{t("posts.suggestions")}</p>
              <div className="sugg">
                {suggestions.map((s, i) => <button key={i} disabled={busy} onClick={() => applyAI(s)}>💡 {s}</button>)}
              </div>
            </>
          )}

          {hasMention && !posted && (
            <div className="hookbox" style={{ marginTop: "var(--s-3)" }}>
              👋 <b>{t("posts.tagging")}</b> {t("posts.taggingNote")}
            </div>
          )}
          {!posted && (
            <Schedule
              post={post}
              status={status}
              blockedReason={
                !draft.trim() ? t("posts.needDraft") :
                draft.length > LIMIT ? t("posts.tooLong") :
                hasMention ? t("posts.noAutoTag") :
                ""
              }
            />
          )}
          <div className="row" style={{ marginTop: "var(--s-4)" }}>
            <button className="ghost" disabled={!history.length} onClick={undo}>{t("posts.undoAi")}</button>
            <button className="ghost" onClick={() => { navigator.clipboard.writeText(draft); toast(t("posts.copied")); }}>{t("posts.copy")}</button>
            <span className="grow" />
            {!posted && <button className="ghost" onClick={markPosted}>{t("posts.markPosted")}</button>}
            <button className="primary big" disabled={busy || status.publish.isPending || posted || !draft.trim() || draft.length > LIMIT} onClick={publish}>
              {posted ? t("posts.sPosted") : hasMention ? t("posts.copyOpen") : t("posts.post")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

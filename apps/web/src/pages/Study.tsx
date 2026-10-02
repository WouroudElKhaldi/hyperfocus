import { useEffect, useMemo, useState } from "react";
import More from "../components/More.tsx";
import { useNavigate } from "react-router-dom";
import { api, studyMins, studySecs, errorOf } from "../api.ts";
import { useToast } from "../App.tsx";
import type { Post, PostIdea, StudySession } from "../types.ts";

/** What the course / part / notes fields edit. */
type StudyFields = { course: string; part: string; notes: string };
/** A saved session being edited. `orig` holds the times as they were, to send only what changed. */
type Editing = StudySession & { from: string; to: string; breakMins: number | string; orig: { from: string; to: string; breakMins: number | string } };

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (at: string | number | null) => {
  const d = new Date(at ?? 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const mins = studyMins; // study time only, breaks are excluded
const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : `${m}m`);
const clock = (d: string | null) => new Date(d ?? 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dayKey = (d: string | number) => new Date(d).toDateString();

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

// Must live outside Study(): Study re-renders every second for the timer, and a component
// defined inside it would be remounted each time, dropping focus from the inputs.
function CourseSelect({ value, onChange, courses }: { value: string; onChange: (course: string) => void; courses: string[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const options = value && !courses.includes(value) ? [...courses, value] : courses;

  const confirm = () => {
    if (name.trim()) onChange(name.trim());
    setName("");
    setAdding(false);
  };

  if (adding)
    return (
      <div className="row grow">
        <input className="grow" autoFocus placeholder="New course name" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") setAdding(false); }} />
        <button className="primary" disabled={!name.trim()} onClick={confirm}>Add</button>
        <button className="ghost" onClick={() => setAdding(false)}>Cancel</button>
      </div>
    );
  return (
    <div className="row grow" style={{ flexWrap: "nowrap" }}>
      <select className="grow" style={{ width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose course…</option>
        {options.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button title="Add a new course" onClick={() => setAdding(true)}>+</button>
    </div>
  );
}

function Fields<T extends StudyFields>({ v, set, courses }: { v: T; set: (v: T) => void; courses: string[] }) {
  return (
    <>
      <div className="row">
        <CourseSelect value={v.course} courses={courses} onChange={(course) => set({ ...v, course })} />
        <input className="grow" placeholder="Part (e.g. Part 1: Intro)" value={v.part} onChange={(e) => set({ ...v, part: e.target.value })} />
      </div>
      <textarea style={{ minHeight: 70, marginTop: "var(--s-2)" }} placeholder="What did you learn or do? (key takeaways, questions…)" value={v.notes} onChange={(e) => set({ ...v, notes: e.target.value })} />
    </>
  );
}

export default function Study() {
  const toast = useToast();
  const nav = useNavigate();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState<StudyFields>({ course: "", part: "", notes: "" });
  const [manual, setManual] = useState({ course: "", part: "", notes: "", from: toLocalInput(Date.now() - 3600000), to: toLocalInput(Date.now()), breakMins: "" });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [ideas, setIdeas] = useState<Record<number, PostIdea[]>>({}); // post ideas per session id
  const [ideaBusy, setIdeaBusy] = useState<number | null>(null);

  const load = () => api.get("/study").then(setSessions).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const running = sessions.find((s) => !s.endedAt);
  const done = sessions.filter((s) => s.endedAt);

  // when a running session appears (start or page reload), load its saved details into the form
  useEffect(() => {
    if (running) setForm({ course: running.course, part: running.part, notes: running.notes });
  }, [running?.id]);

  // While studying, save course / part / notes a second after you stop typing, so a refresh or a crash never loses them
  useEffect(() => {
    if (!running) return;
    if (form.course === running.course && form.part === running.part && form.notes === running.notes) return;
    const t = setTimeout(() => { api.patch(`/study/${running.id}`, form).catch(() => {}); }, 1000);
    return () => clearTimeout(t);
  }, [form, running?.id]);

  const stats = useMemo(() => {
    const today = dayKey(now), week = startOfWeek().getTime();
    let t = 0, w = 0, all = 0;
    const byCourse: Record<string, number> = {};
    for (const s of done) {
      const m = mins(s);
      all += m;
      if (dayKey(s.startedAt) === today) t += m;
      if (new Date(s.startedAt).getTime() >= week) w += m;
      const c = s.course || "No course";
      byCourse[c] = (byCourse[c] || 0) + m;
    }
    return { t, w, all, byCourse };
  }, [sessions]);

  const courses = [...new Set(sessions.map((s) => s.course).filter(Boolean))];

  const start = async () => {
    try { await api.post("/study", form); load(); toast("Timer started. You've got this 💜"); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const pause = async () => {
    if (!running) return;
    try {
      await api.patch(`/study/${running.id}`, form); // keep what you typed safe
      await api.post(`/study/${running.id}/pause`);
      toast("Break started ☕ Your study timer is paused.");
      load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const resume = async () => {
    if (!running) return;
    try { await api.post(`/study/${running.id}/resume`); toast("Welcome back 💜 Timer running."); load(); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const stop = async () => {
    if (!running) return;
    const wasPaused = !!running.pausedAt;
    await api.patch(`/study/${running.id}`, form);
    await api.post(`/study/${running.id}/stop`);
    await load(); // wait until the session shows as stopped, so the auto-save can never overwrite it with an empty form
    setForm({ course: "", part: "", notes: "" });
    toast(wasPaused ? "Session saved 🎉 It ended when your break began." : "Session saved 🎉");
  };
  const addManual = async () => {
    try {
      await api.post("/study", {
        course: manual.course, part: manual.part, notes: manual.notes,
        startedAt: new Date(manual.from).toISOString(), endedAt: new Date(manual.to).toISOString(),
        breakMins: Number(manual.breakMins) || 0,
      });
      setManual({ ...manual, part: "", notes: "", breakMins: "" });
      toast("Session added");
      load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const saveEdit = async () => {
    if (!editing) return;
    try {
      const o = editing.orig;
      const body: StudyFields & { startedAt?: string; endedAt?: string; breakMins?: number } = { course: editing.course, part: editing.part, notes: editing.notes };
      if (editing.from !== o.from) body.startedAt = new Date(editing.from).toISOString();
      if (editing.to !== o.to) body.endedAt = new Date(editing.to).toISOString();
      if (String(editing.breakMins) !== String(o.breakMins)) body.breakMins = Number(editing.breakMins) || 0;
      await api.patch(`/study/${editing.id}`, body);
      setEditing(null); load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  // Undo an accidental stop: the session reopens and the time you were away counts as a break
  const continueSession = async (s: StudySession) => {
    try {
      await api.post(`/study/${s.id}/continue`);
      toast("Continuing this session 💜 The time you were away counts as a break.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      load();
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  // For older sessions: start a fresh one for the same part
  const studyAgain = (s: StudySession) => {
    setForm({ course: s.course, part: s.part, notes: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Course and part are filled in. Press Start when you're ready.");
  };
  const getIdeas = async (s: StudySession) => {
    setIdeaBusy(s.id);
    try {
      const out = await api.post("/ai/post-ideas", { course: s.course, part: s.part, notes: s.notes });
      setIdeas((m) => ({ ...m, [s.id]: out.ideas }));
    }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setIdeaBusy(null);
  };
  const takeIdea = async (idea: PostIdea) => {
    const p = await api.post("/posts", { thought: idea.thought });
    nav(`/posts/${p.id}`);
  };
  const remove = async (s: StudySession) => { if (confirm("Delete this session?")) { await api.del(`/study/${s.id}`); load(); } };
  const toPost = async (s: StudySession) => {
    const thought = `${[s.course, s.part].filter(Boolean).join(" - ")}\n\n${s.notes}`.trim();
    const p = await api.post("/posts", { thought });
    nav(`/posts/${p.id}`);
  };

  const days: { k: string; label: string; items: StudySession[] }[] = [];
  for (const s of done) {
    const k = dayKey(s.startedAt);
    let g = days.find((d) => d.k === k);
    if (!g) days.push((g = { k, label: new Date(s.startedAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }), items: [] }));
    g.items.push(s);
  }

  const paused = !!running?.pausedAt;
  const activeSecs = running ? studySecs(running, now) : 0; // study time so far, breaks excluded
  const elapsed = Math.floor(activeSecs / 60);
  const secs = activeSecs % 60;
  const thisBreak = running?.pausedAt ? Math.max(0, Math.floor((now - new Date(running.pausedAt).getTime()) / 1000)) : 0; // = paused
  const breakTotalMins = running ? Math.round(((running.breakMs || 0) + thisBreak * 1000) / 60000) : 0;

  return (
    <>
      <h1>SE Square study log</h1>
      <p className="sub">Start the timer, study, stop and save. That is all.</p>

      <div className="stats">
        {([["Today", fmt(stats.t)], ["This week", fmt(stats.w)], ["Total", fmt(stats.all)], ["Sessions", done.length]] as [string, string | number][]).map(([l, v]) => (
          <div className="card stat" key={l}><div className="muted">{l}</div><div className="big-num">{v}</div></div>
        ))}
      </div>

      <div className="card">
        <h2>{running ? "Studying now" : "Start a session"}</h2>
        {running ? (
          <>
            <div className={"timer" + (paused ? " paused" : "")}>{pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}:{pad(secs)}</div>
            {paused ? (
              <p className="break-note">☕ On a break for {pad(Math.floor(thisBreak / 60))}:{pad(thisBreak % 60)}. Your study timer is paused.</p>
            ) : (
              <p className="muted">Started {clock(running.startedAt)}. Study time only, breaks are not counted.</p>
            )}
            {breakTotalMins > 0 && <p className="muted">Breaks so far: {fmt(breakTotalMins)}</p>}
            <Fields courses={courses} v={form} set={setForm} />
            <div className="row" style={{ marginTop: "var(--s-3)" }}>
              {paused
                ? <button className="primary big" onClick={resume}>▶ Resume</button>
                : <button className="big" onClick={pause}>⏸ Take a break</button>}
              <button className={paused ? "big" : "primary big"} onClick={stop}>■ Stop & save</button>
            </div>
          </>
        ) : (
          <>
            <Fields courses={courses} v={form} set={setForm} />
            <button className="primary big" style={{ marginTop: "var(--s-3)" }} onClick={start}>▶ Start timer</button>
          </>
        )}
      </div>

      <div className="card plain-more">
        <More label="Forgot the timer? Add a past session">
        <p className="muted">Add it with the real times.</p>
        <div className="row" style={{ marginBottom: "var(--s-2)" }}>
          <label className="grow muted">From<input type="datetime-local" value={manual.from} onChange={(e) => setManual({ ...manual, from: e.target.value })} /></label>
          <label className="grow muted">To<input type="datetime-local" value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} /></label>
          <label className="muted">Break (min)<input type="number" min="0" style={{ width: 90 }} placeholder="0" value={manual.breakMins} onChange={(e) => setManual({ ...manual, breakMins: e.target.value })} /></label>
        </div>
        <Fields courses={courses} v={manual} set={setManual} />
        <button className="primary" style={{ marginTop: "var(--s-3)" }} onClick={addManual}>Add session</button>
        </More>
      </div>

      {Object.keys(stats.byCourse).length > 0 && (
        <div className="card plain-more">
          <More label="Time by course">
          {Object.entries(stats.byCourse).map(([c, m]) => (
            <div key={c} style={{ marginBottom: "var(--s-3)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}><b>{c}</b><span>{fmt(m)}</span></div>
              <div className="bar"><div style={{ width: `${(m / stats.all) * 100}%` }} /></div>
            </div>
          ))}
          </More>
        </div>
      )}

      <h2 style={{ marginTop: "var(--s-5)" }}>Log</h2>
      {days.length === 0 && <div className="empty">No sessions yet. Your first one counts the most.</div>}
      {days.map((d) => (
        <div className="card" key={d.k}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>{d.label}</h2>
            <span className="chip">{fmt(d.items.reduce((a, s) => a + mins(s), 0))}</span>
          </div>
          {d.items.map((s) => (
            <div className="item" key={s.id}>
              {editing?.id === s.id ? (
                <div className="grow">
                  <div className="row" style={{ marginBottom: "var(--s-2)" }}>
                    <input type="datetime-local" className="grow" value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value })} />
                    <input type="datetime-local" className="grow" value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })} />
                    <label className="muted">Break (min) <input type="number" min="0" style={{ width: 80 }} value={editing.breakMins} onChange={(e) => setEditing({ ...editing, breakMins: e.target.value })} /></label>
                  </div>
                  <Fields courses={courses} v={editing} set={(v) => setEditing({ ...editing, ...v })} />
                  <p className="muted tiny">You can add time to a saved session (later end, earlier start, shorter break), but not remove it. Notes, course and part can change freely.</p>
                  <div className="row" style={{ marginTop: "var(--s-2)" }}>
                    <button className="primary" onClick={saveEdit}>Save</button>
                    <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="grow">
                  <div className="row">
                    <b>{clock(s.startedAt)} → {clock(s.endedAt)}</b>
                    <span className="chip">{fmt(mins(s))}</span>
                    {s.breakMs > 0 && <span className="muted" title="Not counted as study time">☕ {fmt(Math.round(s.breakMs / 60000))} break</span>}
                    {s.course && <span>{s.course}</span>}
                    {s.part && <span className="muted">· {s.part}</span>}
                  </div>
                  {s.notes && <div className="pre" style={{ marginTop: "var(--s-1)" }}>{s.notes}</div>}
                  {ideas[s.id] && (
                    <div className="refined">
                      {(ideas[s.id] ?? []).map((i, n) => (
                        <div key={n} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", marginBottom: "var(--s-2)" }}>
                          <div className="grow"><b>{i.angle}</b><div className="muted pre">{i.thought}</div></div>
                          <button className="primary" onClick={() => takeIdea(i)}>Use this</button>
                        </div>
                      ))}
                      <button className="ghost" onClick={() => setIdeas((m) => { const c = { ...m }; delete c[s.id]; return c; })}>Hide</button>
                    </div>
                  )}
                  <div className="row" style={{ marginTop: "var(--s-1)" }}>
                    {!running && now - new Date(s.endedAt ?? 0).getTime() <= 6 * 3600 * 1000 && (
                      <button className="ghost" onClick={() => continueSession(s)} title="Stopped by mistake? Reopen it and keep going. The time away counts as a break.">▶ Continue</button>
                    )}
                    {!running && now - new Date(s.endedAt ?? 0).getTime() > 6 * 3600 * 1000 && (
                      <button className="ghost" onClick={() => studyAgain(s)} title="Start a new session with the same course and part">🔁 Study this part again</button>
                    )}
                    <More label="More" className="inline">
                    <button className="ghost" disabled={!s.notes.trim()} onClick={() => toPost(s)}>💼 Make post from notes</button>
                    <button className="ghost" disabled={s.notes.trim().length < 15 || ideaBusy === s.id} onClick={() => getIdeas(s)} title="3 different post angles based on your notes">
                      {ideaBusy === s.id ? "Thinking…" : "💡 3 post ideas"}
                    </button>
                    <button className="ghost" onClick={() => {
                      const v: Editing["orig"] = { from: toLocalInput(s.startedAt), to: toLocalInput(s.endedAt), breakMins: Math.round(s.breakMs / 60000) || "" };
                      setEditing({ ...s, ...v, orig: v });
                    }}>Edit</button>
                    <button className="ghost" onClick={() => remove(s)}>Delete</button>
                    </More>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

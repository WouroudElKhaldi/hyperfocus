import { type FormEvent, useEffect, useMemo, useState } from "react";
import { api, errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import type { Skill, SkillPlan, SkillSuggestion } from "../../../types.ts";

const LEVELS = ["Not rated yet", "Shaky", "Learning it", "Comfortable", "Strong", "Could teach it"];
const AREAS = ["Design & architecture", "Code quality", "Data & databases", "Delivery & DevOps", "Security & performance", "Communication & leadership", "Product & UX", "Other"] as const;
type NewSkill = { name: string; area: string; why?: string };
const STARTER: NewSkill[] = ([
  ["Design patterns", 0], ["System design", 0], ["Software architecture", 0], ["API design", 0],
  ["Clean code & refactoring", 1], ["Testing (unit & integration)", 1], ["Code review", 1], ["Debugging hard bugs", 1],
  ["SQL & database design", 2], ["Data structures & algorithms", 2],
  ["CI/CD & deployment", 3], ["Git workflows", 3], ["Cloud basics", 3],
  ["Web security basics", 4], ["Performance optimization", 4],
  ["Technical writing", 5], ["Mentoring & giving feedback", 5], ["Estimating & planning work", 5],
  ["Accessibility", 6], ["Product thinking", 6],
] as [string, number][]).map(([name, a]) => ({ name, area: AREAS[a] ?? "Other" }));

function Dots({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="dots" title={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={"dot" + (n <= value ? " on" : "")} onClick={() => onChange(n === value ? 0 : n)} aria-label={`${label} ${n}`} />
      ))}
    </span>
  );
}

// Top-level so inputs keep focus when the list re-renders.
function SkillRow({ skill, onChange, onDelete }: { skill: Skill; onChange: (s: Skill) => void; onDelete: () => void }) {
  const toast = useToast();
  const [plan, setPlan] = useState<SkillPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(skill.notes);
  const gap = skill.level > 0 ? Math.max(0, skill.target - skill.level) : null;

  const patch = async (body: Partial<Skill>) => onChange(await api.patch(`/skills/${skill.id}`, body));
  const getPlan = async () => {
    setBusy(true);
    try { setPlan(await api.post(`/skills/${skill.id}/plan`)); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };
  const addTask = async (title: string) => { await api.post("/tasks", { title: `${skill.name}: ${title}` }); toast("Added to your tasks ✅"); };
  const addBook = async (b: { title: string; author: string }) => { await api.post("/books", { title: b.title, author: b.author }); toast("Added to your books 📖"); };

  return (
    <div className="item skill">
      <div className="grow">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <b>{skill.name}</b>
          <div className="row" style={{ flexWrap: "nowrap", gap: 0 }}>
            <button className="ghost" disabled={busy} onClick={getPlan}>{busy ? "Thinking…" : "🪄 How to close it"}</button>
            <button className="ghost" onClick={onDelete}>✕</button>
          </div>
        </div>
        <div className="row" style={{ gap: "var(--s-3)", marginTop: "var(--s-1)" }}>
          <span className="row" style={{ gap: "var(--s-1)" }}>
            <span className="muted tiny">Me now</span>
            <Dots value={skill.level} label="level" onChange={(n) => patch({ level: n })} />
            <span className="muted tiny">{LEVELS[skill.level]}</span>
          </span>
          <span className="row" style={{ gap: "var(--s-1)" }}>
            <span className="muted tiny">Goal</span>
            <Dots value={skill.target} label="target" onChange={(n) => patch({ target: n || 1 })} />
          </span>
          {gap !== null && <span className={"chip " + (gap === 0 ? "posted" : "")}>{gap === 0 ? "✓ Reached" : `gap ${gap}`}</span>}
        </div>
        <input className="skill-notes" placeholder="Notes (what I tried, what confuses me…)" value={notes}
          onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== skill.notes && patch({ notes })} />
        {plan && (
          <div className="refined">
            {plan.steps.map((s, i) => (
              <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
                <span className="grow">{i + 1}. {s}</span>
                <button className="ghost" onClick={() => addTask(s)}>➕ task</button>
              </div>
            ))}
            {plan.books.length > 0 && <div className="muted tiny" style={{ marginTop: "var(--s-2)" }}>Books that may help (the Books page checks they exist):</div>}
            {plan.books.map((b, i) => (
              <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
                <span className="grow">📖 {b.title}{b.author && ` · ${b.author}`}</span>
                <button className="ghost" onClick={() => addBook(b)}>➕ my books</button>
              </div>
            ))}
            <button className="ghost" onClick={() => setPlan(null)}>Hide</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Skills() {
  const toast = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [name, setName] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [context, setContext] = useState("");
  const [ideas, setIdeas] = useState<SkillSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/skills").then(setSkills).catch((e) => toast(e.message, "err")); }, []);
  const replace = (s: Skill) => setSkills((l) => l.map((x) => (x.id === s.id ? s : x)));

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { const s = await api.post("/skills", { name, area }); setSkills((l) => [...l, s]); setName(""); }
    catch (caught) { const err = errorOf(caught); toast(err.message, "err"); }
  };
  const remove = async (s: Skill) => { await api.del(`/skills/${s.id}`); setSkills((l) => l.filter((x) => x.id !== s.id)); };
  const addMany = async (items: NewSkill[]) => { setSkills(await api.post("/skills/bulk", { items })); };

  const suggest = async () => {
    setBusy(true);
    try { setIdeas((await api.post("/skills/suggest", { context })).skills); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };

  const rated = skills.filter((s) => s.level > 0);
  const gaps = rated.filter((s) => s.target > s.level).sort((a, b) => b.target - b.level - (a.target - a.level)).slice(0, 3);
  const unrated = skills.length - rated.length;

  const byArea = useMemo(() => {
    const m: Record<string, Skill[]> = {};
    for (const s of skills) (m[s.area || "Other"] ??= []).push(s);
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [skills]);

  return (
    <>
      <h1>Skills gap map</h1>
      <p className="sub">Name the gaps, rate yourself honestly, and pick what to work on. A gap isn't a failure, it's a to-do list.</p>

      {skills.length > 0 && (
        <div className="grid2">
          <div className="card">
            <h2>Biggest gaps</h2>
            {gaps.length === 0 && <p className="muted">{rated.length ? "No gaps left among the skills you rated. Great!" : "Rate a few skills below and your biggest gaps show up here."}</p>}
            {gaps.map((g) => (
              <div key={g.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{g.name}</span><span className="chip">{LEVELS[g.level]} → goal {g.target}</span>
              </div>
            ))}
            {unrated > 0 && <p className="muted tiny" style={{ marginTop: "var(--s-2)" }}>{unrated} skill{unrated > 1 ? "s" : ""} not rated yet. Rate only what you know; a rough guess is fine.</p>}
          </div>
          <div className="card">
            <h2>By area</h2>
            {byArea.map(([a, list]) => {
              const r = list.filter((s) => s.level > 0);
              const avg = r.length ? r.reduce((t, s) => t + s.level, 0) / r.length : 0;
              const tgt = list.reduce((t, s) => t + s.target, 0) / list.length;
              return (
                <div key={a} style={{ marginBottom: "var(--s-2)" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="tiny">{a}</span><span className="muted tiny">{r.length ? avg.toFixed(1) : "–"} / {tgt.toFixed(1)}</span>
                  </div>
                  <div className="bar"><div style={{ width: `${(avg / 5) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <form className="row" onSubmit={add}>
          <input className="grow" placeholder="Add a skill… e.g. Designing REST APIs" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={area} onChange={(e) => setArea(e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
          <button className="primary" disabled={!name.trim()}>Add</button>
        </form>
        <div className="row" style={{ marginTop: "var(--s-2)" }}>
          <button onClick={() => addMany(STARTER)}>📋 Add a starter list ({STARTER.length} common senior skills)</button>
          <button onClick={() => setHelpOpen(!helpOpen)}>✨ Help me find my gaps (AI)</button>
        </div>
        {helpOpen && (
          <div className="refined">
            <p className="muted tiny">Tell me what you work on, and what feels shaky or scary. Messy is fine.</p>
            <textarea style={{ minHeight: 70 }} value={context} onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. I build React screens and some Node APIs. I avoid database design and I'm never sure how to structure a big feature…" />
            <button className="primary" style={{ marginTop: "var(--s-2)" }} disabled={busy || !context.trim()} onClick={suggest}>{busy ? "Thinking…" : "Suggest skills to work on"}</button>
            {ideas.map((i) => (
              <div key={i.name} className="row" style={{ flexWrap: "nowrap", marginTop: "var(--s-2)" }}>
                <div className="grow"><b>{i.name}</b> <span className="muted tiny">{i.area}</span><div className="muted tiny">{i.why}</div></div>
                <button onClick={async () => { await addMany([i]); setIdeas((l) => l.filter((x) => x.name !== i.name)); toast("Added"); }}>➕ Add</button>
              </div>
            ))}
            {ideas.length > 1 && <button className="ghost" onClick={async () => { await addMany(ideas); setIdeas([]); }}>Add all</button>}
          </div>
        )}
      </div>

      {skills.length === 0 && <div className="empty">No skills yet. Add a starter list or let the AI help you find them.</div>}
      {byArea.map(([a, list]) => (
        <div className="card" key={a}>
          <h2>{a}</h2>
          {list.map((s) => <SkillRow key={s.id} skill={s} onChange={replace} onDelete={() => remove(s)} />)}
        </div>
      ))}
    </>
  );
}

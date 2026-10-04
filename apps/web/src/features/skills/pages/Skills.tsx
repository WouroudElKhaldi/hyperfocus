import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { type FormEvent, useMemo, useState } from "react";
import TaxonomyPicker from "../../../components/TaxonomyPicker.tsx";
import { useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import type { Skill, SkillPlan, SkillSuggestion } from "../../../types.ts";
import { useAddTask } from "../../tasks/index.ts";
import { useAddSkill, useAddSkills, useDeleteSkill, useSkills, useUpdateSkill } from "../api.ts";
import JobSkills from "../components/JobSkills.tsx";

// (words in the language files; read each time so they follow the chosen language)
const LEVEL_KEYS = ["lv0", "lv1", "lv2", "lv3", "lv4", "lv5"] as const;
const levelName = (level: number) => i18next.t(`skills.${LEVEL_KEYS[level] ?? "lv0"}`);
// (the area is saved as written, in the language chosen when the skill was added)
const AREAS = () => (["ar0", "ar1", "ar2", "ar3", "ar4"] as const).map((k) => i18next.t(`skills.${k}`));
type NewSkill = { name: string; area: string; why?: string };

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
function SkillRow({ skill, onDelete }: { skill: Skill; onDelete: () => void }) {
  const toast = useToast();
  const [plan, setPlan] = useState<SkillPlan | null>(null);
  const update = useUpdateSkill();
  const planChange = useApiChange("post", `/skills/${skill.id}/plan`, { onSuccess: setPlan });
  const addTaskChange = useAddTask();
  const addBookChange = useApiChange("post", "/books", { refresh: ["/books"] });
  const busy = planChange.isPending;
  const [notes, setNotes] = useState(skill.notes);
  const [linking, setLinking] = useState(false); // P6-08: picking the standard skill this one is
  const gap = skill.level > 0 ? Math.max(0, skill.target - skill.level) : null;

  const patch = (change: Parameters<typeof update.mutate>[0]["change"]) => update.mutate({ id: skill.id, change });
  const getPlan = () => planChange.mutate(undefined);
  const addTask = (title: string) => addTaskChange.mutate({ title: `${skill.name}: ${title}` }, { onSuccess: () => toast(i18next.t("skills.addedToYourTasks")) });
  const addBook = (b: { title: string; author: string }) => addBookChange.mutate({ title: b.title, author: b.author }, { onSuccess: () => toast(i18next.t("skills.addedToYourBooks")) });

  return (
    <div className="item skill">
      <div className="grow">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <b>{skill.name}</b>
          <div className="row" style={{ flexWrap: "nowrap", gap: 0 }}>
            <button className="ghost" disabled={busy} onClick={getPlan}>{busy ? i18next.t("skills.thinking") : i18next.t("skills.howToCloseIt")}</button>
            <button className="ghost" onClick={onDelete}>✕</button>
          </div>
        </div>
        <div className="row" style={{ gap: "var(--s-3)", marginTop: "var(--s-1)" }}>
          <span className="row" style={{ gap: "var(--s-1)" }}>
            <span className="muted tiny">{i18next.t("skills.meNow")}</span>
            <Dots value={skill.level} label={i18next.t("skills.level")} onChange={(n) => patch({ level: n })} />
            <span className="muted tiny">{levelName(skill.level)}</span>
          </span>
          <span className="row" style={{ gap: "var(--s-1)" }}>
            <span className="muted tiny">{i18next.t("skills.goal")}</span>
            <Dots value={skill.target} label={i18next.t("skills.target")} onChange={(n) => patch({ target: n || 1 })} />
          </span>
          {gap !== null && <span className={"chip " + (gap === 0 ? "posted" : "")}>{gap === 0 ? i18next.t("skills.reached") : `gap ${gap}`}</span>}
        </div>
        <input className="skill-notes" placeholder={i18next.t("skills.notesWhatITried")} value={notes}
          onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== skill.notes && patch({ notes })} />
        {/* P6-08: optionally, which standard skill this is (Job Radar matches jobs on it); the name above stays yours */}
        <div className="row skill-standard" style={{ gap: "var(--s-2)", marginTop: "var(--s-1)" }}>
          {skill.taxonomyCode ? (
            <>
              <span className="muted tiny">{i18next.t("skills.standardSkill")} <b>{skill.taxonomyLabel}</b></span>
              <button className="ghost tiny" onClick={() => patch({ taxonomyCode: "" })}>{i18next.t("skills.unlink")}</button>
            </>
          ) : linking ? (
            <>
              <TaxonomyPicker kind="skill" label={`Standard skill for ${skill.name}`} placeholder={i18next.t("skills.typeToFindIt")} autoFocus
                onPick={(it) => { patch({ taxonomyCode: it.code }); setLinking(false); }} />
              <button className="ghost tiny" onClick={() => setLinking(false)}>{i18next.t("skills.cancel")}</button>
            </>
          ) : (
            <button className="ghost tiny" onClick={() => setLinking(true)}>{i18next.t("skills.linkToAStandard")}</button>
          )}
        </div>
        {plan && (
          <div className="refined">
            {plan.steps.map((s, i) => (
              <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
                <span className="grow">{i + 1}. {s}</span>
                <button className="ghost" onClick={() => addTask(s)}>{i18next.t("skills.task")}</button>
              </div>
            ))}
            {plan.books.length > 0 && <div className="muted tiny" style={{ marginTop: "var(--s-2)" }}>{i18next.t("skills.booksThatMayHelp")}</div>}
            {plan.books.map((b, i) => (
              <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
                <span className="grow">📖 {b.title}{b.author && ` · ${b.author}`}</span>
                <button className="ghost" onClick={() => addBook(b)}>{i18next.t("skills.myBooks")}</button>
              </div>
            ))}
            <button className="ghost" onClick={() => setPlan(null)}>{i18next.t("skills.hide")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Skills() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const skills = useSkills().data ?? [];
  const addSkill = useAddSkill();
  const addSkills = useAddSkills();
  const deleteSkill = useDeleteSkill();
  const [name, setName] = useState("");
  const [area, setArea] = useState<string>(() => AREAS()[0] ?? "");
  const [helpOpen, setHelpOpen] = useState(false);
  const [context, setContext] = useState("");
  const [ideas, setIdeas] = useState<SkillSuggestion[]>([]);
  const suggestChange = useApiChange("post", "/skills/suggest", { onSuccess: (r) => setIdeas(r.skills) });
  const busy = suggestChange.isPending;

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addSkill.mutate({ name, area }, { onSuccess: () => setName("") });
  };
  const remove = (s: Skill) => deleteSkill.mutate(s.id);
  const addMany = (items: NewSkill[]) => addSkills.mutateAsync(items);
  const suggest = () => suggestChange.mutate({ context });

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
      <h1>{i18next.t("skills.skillsGapMap")}</h1>
      <p className="sub">{i18next.t("skills.nameTheGapsRate")}</p>

      {skills.length > 0 && (
        <div className="grid2">
          <div className="card">
            <h2>{i18next.t("skills.biggestGaps")}</h2>
            {gaps.length === 0 && <p className="muted">{rated.length ? i18next.t("skills.noGapsLeftAmong") : i18next.t("skills.rateAFewSkills")}</p>}
            {gaps.map((g) => (
              <div key={g.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{g.name}</span><span className="chip">{i18next.t("skills.toGoal", { level: levelName(g.level), target: g.target })}</span>
              </div>
            ))}
            {unrated > 0 && <p className="muted tiny" style={{ marginTop: "var(--s-2)" }}>{unrated} skill{unrated > 1 ? "s" : ""} not rated yet. Rate only what you know; a rough guess is fine.</p>}
          </div>
          <div className="card">
            <h2>{i18next.t("skills.byArea")}</h2>
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

      <JobSkills />

      <div className="card">
        <form className="row" onSubmit={add}>
          <input className="grow" placeholder={i18next.t("skills.addASkillE")} value={name} onChange={(e) => setName(e.target.value)} />
          <select value={area} onChange={(e) => setArea(e.target.value)}>{AREAS().map((a) => <option key={a}>{a}</option>)}</select>
          <button className="primary" disabled={!name.trim()}>{i18next.t("skills.add")}</button>
        </form>
        <div className="row" style={{ marginTop: "var(--s-2)" }}>
          <button onClick={() => setHelpOpen(!helpOpen)}>{i18next.t("skills.helpMeFindMy")}</button>
        </div>
        {helpOpen && (
          <div className="refined">
            <p className="muted tiny">{i18next.t("skills.tellMeWhatYou")}</p>
            <textarea style={{ minHeight: 70 }} value={context} onChange={(e) => setContext(e.target.value)}
              placeholder={i18next.t("skills.eGIM")} />
            <button className="primary" style={{ marginTop: "var(--s-2)" }} disabled={busy || !context.trim()} onClick={suggest}>{busy ? i18next.t("skills.thinking") : i18next.t("skills.suggestSkillsToWork")}</button>
            {ideas.map((i) => (
              <div key={i.name} className="row" style={{ flexWrap: "nowrap", marginTop: "var(--s-2)" }}>
                <div className="grow"><b>{i.name}</b> <span className="muted tiny">{i.area}</span><div className="muted tiny">{i.why}</div></div>
                <button onClick={async () => { await addMany([i]); setIdeas((l) => l.filter((x) => x.name !== i.name)); toast(i18next.t("skills.added")); }}>{i18next.t("skills.add2")}</button>
              </div>
            ))}
            {ideas.length > 1 && <button className="ghost" onClick={async () => { await addMany(ideas); setIdeas([]); }}>{i18next.t("skills.addAll")}</button>}
          </div>
        )}
      </div>

      {skills.length === 0 && <div className="empty">{i18next.t("skills.noSkillsYetAdd")}</div>}
      {byArea.map(([a, list]) => (
        <div className="card" key={a}>
          <h2>{a}</h2>
          {list.map((s) => <SkillRow key={s.id} skill={s} onDelete={() => remove(s)} />)}
        </div>
      ))}
    </>
  );
}

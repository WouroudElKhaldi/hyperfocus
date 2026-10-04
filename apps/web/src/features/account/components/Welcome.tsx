import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../../api.ts";
import { type AboutMe, BrainQuestions, EMPTY_ABOUT_ME, PronounsQuestion, SituationQuestion, StudyQuestions, StyleQuestions } from "../../../components/AboutMe.tsx";
import TaxonomyPicker from "../../../components/TaxonomyPicker.tsx";
import { useMajors } from "../../radar/index.ts";
import { useMe } from "../api.ts";

// The welcome guide (P5-05, longer in P5-14): six short screens for someone new. Big buttons, every question
// skippable, and the whole guide too; everything can be changed later in Profile. What they share makes the AI's help
// theirs (their studies, how their brain works, what helps, the tone they like). Finishing it also sets things up:
// "find jobs" makes their Job Radar filter from what they study, their job title (or the job they want) brings the
// skills it needs to their Skills page, and they land on the page that fits what they picked.

// (labels in the language files: the label key is beside each choice)
const HELP = [
  ["focus", "h1"],
  ["tasks", "h2"],
  ["study", "h3"],
  ["jobs", "h4"],
  ["habits", "h5"],
] as const;
type Help = (typeof HELP)[number][0];
const STEPS = 6;

export default function Welcome() {
  useTranslation(); // (re-renders this page when the language changes)
  const me = useMe().data;
  const majors = useMajors().data ?? [];
  const client = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(me?.user?.name ?? "");
  const [field, setField] = useState<{ code: string; label: string } | null>(null);
  const [job, setJob] = useState<{ code: string; label: string } | null>(null);
  const [help, setHelp] = useState<Help[]>([]);
  const [about, setAbout] = useState<AboutMe>(EMPTY_ABOUT_ME);
  const set = (patch: Partial<AboutMe>) => setAbout((a) => ({ ...a, ...patch }));
  const pickField = (f: { code: string; label: string } | null) => {
    setField(f);
    if (f && !about.major) set({ major: f.label });
  };
  const after = async (next: string) => {
    await client.invalidateQueries();
    await navigate({ to: next });
  };
  const finish = useMutation({
    mutationFn: async () => {
      const done = (await api.post("/onboarding", { name: name.trim() || (me?.user?.name ?? i18next.t("account.me")), fieldCode: field?.code ?? null, helpWith: help, about })) as { next: string };
      if (job) await api.put("/skills/job", { code: job.code }); // the skills their job needs, on the Skills page
      return done;
    },
    onSuccess: (r) => after(r.next),
  });
  const skip = useMutation({ mutationFn: () => api.post("/onboarding/skip"), onSuccess: () => after("/") });
  const toggle = (h: Help) => setHelp((on) => (on.includes(h) ? on.filter((x) => x !== h) : [...on, h]));
  const nav = (answered: boolean) => (
    <div className="row" style={{ marginTop: 16 }}>
      <button type="button" onClick={() => setStep(step - 1)}>{i18next.t("account.back")}</button>
      <button type="button" className="primary" onClick={() => setStep(step + 1)}>{answered ? i18next.t("account.next") : i18next.t("aboutme.skipQuestion")}</button>
    </div>
  );

  return (
    <section className="card welcome" style={{ maxWidth: 680, margin: "24px auto" }} aria-labelledby="welcome-title">
      <p className="muted" aria-live="polite">{i18next.t("aboutme.stepOf", { n: step, m: STEPS })}</p>
      <div className="xpbar mini" aria-hidden="true" style={{ marginBottom: 16 }}><span style={{ width: `${(step / STEPS) * 100}%` }} /></div>

      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
          <h1 id="welcome-title">{i18next.t("account.welcomeWhatShouldWe")}</h1>
          <div className="field">
            <label htmlFor="welcome-name">{i18next.t("account.yourName")}</label>
            <input id="welcome-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <PronounsQuestion value={about} set={set} />
          <button className="primary" type="submit" disabled={!name.trim()} style={{ marginTop: 16 }}>{i18next.t("account.next")}</button>
        </form>
      )}

      {step === 2 && (
        <>
          <h1 id="welcome-title">{i18next.t("account.whatDoYouStudy")}</h1>
          <p className="muted">{i18next.t("account.itHelpsUsSuggest")}</p>
          <StudyQuestions value={about} set={set} majorPicker={
            <>
              <fieldset className="row" style={{ gap: 6, flexWrap: "wrap", border: 0, padding: 0 }}>
                <legend className="sr-only">{i18next.t("account.majors")}</legend>
                {majors.map((m) => (
                  <button key={m.code} type="button" className={`chip ${field?.code === m.code ? "on" : ""}`} aria-pressed={field?.code === m.code} onClick={() => pickField(field?.code === m.code ? null : { code: m.code, label: m.label })}>{m.label}</button>
                ))}
              </fieldset>
              <div style={{ margin: "12px 0" }}>
                <TaxonomyPicker kind="field" label={i18next.t("account.anotherFieldOfStudy")} placeholder={i18next.t("account.notListedTypeIt")} onPick={(it) => pickField({ code: it.code, label: it.label })} />
              </div>
              {field && <p>{i18next.t("account.picked")} <b>{field.label}</b></p>}
            </>
          } />
          {nav(!!about.studyLevel)}
        </>
      )}

      {step === 3 && (
        <>
          <h1 id="welcome-title">{i18next.t("aboutme.workTitle")}</h1>
          <p className="muted">{i18next.t("aboutme.workIntro")}</p>
          <SituationQuestion value={about} set={set} />
          <div style={{ margin: "12px 0" }}>
            <TaxonomyPicker kind="occupation" label={i18next.t("account.yourJobOrThe")} placeholder={i18next.t("account.typeAJobNurse")} onPick={(it) => setJob({ code: it.code, label: it.label })} />
          </div>
          {job && <p>{i18next.t("account.yourJob")} <b>{job.label}</b></p>}
          {nav(!!about.situation || !!job)}
        </>
      )}

      {step === 4 && (
        <>
          <h1 id="welcome-title">{i18next.t("aboutme.brainTitle")}</h1>
          <BrainQuestions value={about} set={set} />
          {nav(about.neuro.length > 0 || about.supports.length > 0 || !!about.neuroNote.trim())}
        </>
      )}

      {step === 5 && (
        <>
          <h1 id="welcome-title">{i18next.t("aboutme.styleTitle")}</h1>
          <p className="muted">{i18next.t("aboutme.styleIntro")}</p>
          <StyleQuestions value={about} set={set} />
          {nav(!!about.tone || !!about.bestTime || !!about.focusMins)}
        </>
      )}

      {step === 6 && (
        <>
          <h1 id="welcome-title">{i18next.t("account.whatDoYouWant")}</h1>
          <p className="muted">{i18next.t("account.pickAnyYouCan")}</p>
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend className="sr-only">{i18next.t("account.helpWith")}</legend>
            {HELP.map(([key, label]) => (
              <label key={key} className="row" style={{ padding: "6px 0" }}>
                <input type="checkbox" checked={help.includes(key)} onChange={() => toggle(key)} />
                <span>{i18next.t(`account.${label}`)}</span>
              </label>
            ))}
          </fieldset>
          {help.includes("jobs") && field && me?.radar && <p className="muted">{i18next.t("account.startJobRadar", { field: field.label })}</p>}
          <div className="row">
            <button type="button" onClick={() => setStep(5)}>{i18next.t("account.back")}</button>
            <button type="button" className="primary" disabled={finish.isPending} onClick={() => finish.mutate()}>{i18next.t("account.letSGo")}</button>
          </div>
        </>
      )}
      <p style={{ marginTop: 16 }}><button type="button" className="ghost" disabled={skip.isPending} onClick={() => skip.mutate()}>{i18next.t("account.skipTheWelcome")}</button></p>
    </section>
  );
}

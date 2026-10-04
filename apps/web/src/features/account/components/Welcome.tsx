import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../../api.ts";
import TaxonomyPicker from "../../../components/TaxonomyPicker.tsx";
import { useMajors } from "../../radar/index.ts";
import { useMe } from "../api.ts";

// The welcome guide (P5-05): three short screens for someone new. One question each, big buttons, skippable at any
// point, and everything can be changed later. Finishing it sets things up: "Find jobs" makes their Job Radar filter
// from what they study, and they land on the page that fits what they picked.

const HELP = [
  ["focus", "🎯 Getting started and staying focused"],
  ["tasks", "✅ Keeping track of what to do"],
  ["study", "📚 Studying and exams"],
  ["jobs", "💼 Finding internships and jobs"],
  ["habits", "🌱 Building habits and goals"],
] as const;
type Help = (typeof HELP)[number][0];

export default function Welcome() {
  const me = useMe().data;
  const majors = useMajors().data ?? [];
  const client = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(me?.user?.name ?? "");
  const [field, setField] = useState<{ code: string; label: string } | null>(null);
  const [help, setHelp] = useState<Help[]>([]);
  const after = async (next: string) => {
    await client.invalidateQueries();
    await navigate({ to: next });
  };
  const finish = useMutation({
    mutationFn: () => api.post("/onboarding", { name: name.trim() || (me?.user?.name ?? "Me"), fieldCode: field?.code ?? null, helpWith: help }) as Promise<{ next: string }>,
    onSuccess: (r) => after(r.next),
  });
  const skip = useMutation({ mutationFn: () => api.post("/onboarding/skip"), onSuccess: () => after("/") });
  const toggle = (h: Help) => setHelp((on) => (on.includes(h) ? on.filter((x) => x !== h) : [...on, h]));

  return (
    <section className="card" style={{ maxWidth: 640, margin: "24px auto" }} aria-labelledby="welcome-title">
      <p className="muted" aria-live="polite">Step {step} of 3</p>
      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
          <h1 id="welcome-title">Welcome! What should we call you?</h1>
          <div className="field">
            <label htmlFor="welcome-name">Your name</label>
            <input id="welcome-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="primary" type="submit" disabled={!name.trim()}>Next</button>
        </form>
      )}
      {step === 2 && (
        <>
          <h1 id="welcome-title">What do you study?</h1>
          <p className="muted">It helps us suggest internships and jobs. Not a student? Skip this one.</p>
          <fieldset className="row" style={{ gap: 6, flexWrap: "wrap", border: 0, padding: 0 }}>
            <legend className="sr-only">Majors</legend>
            {majors.map((m) => (
              <button key={m.code} type="button" className={`chip ${field?.code === m.code ? "on" : ""}`} aria-pressed={field?.code === m.code} onClick={() => setField(field?.code === m.code ? null : { code: m.code, label: m.label })}>{m.label}</button>
            ))}
          </fieldset>
          <div style={{ margin: "12px 0" }}>
            <TaxonomyPicker kind="field" label="Another field of study" placeholder="Not listed? Type it…" onPick={(it) => setField({ code: it.code, label: it.label })} />
          </div>
          {field && <p>Picked: <b>{field.label}</b></p>}
          <div className="row">
            <button type="button" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="primary" onClick={() => setStep(3)}>{field ? "Next" : "Skip this"}</button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h1 id="welcome-title">What do you want help with?</h1>
          <p className="muted">Pick any. You can use everything anyway.</p>
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend className="sr-only">Help with</legend>
            {HELP.map(([key, label]) => (
              <label key={key} className="row" style={{ padding: "6px 0" }}>
                <input type="checkbox" checked={help.includes(key)} onChange={() => toggle(key)} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {help.includes("jobs") && field && <p className="muted">We'll start Job Radar with {field.label} jobs for you.</p>}
          <div className="row">
            <button type="button" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="primary" disabled={finish.isPending} onClick={() => finish.mutate()}>Let's go</button>
          </div>
        </>
      )}
      <p style={{ marginTop: 16 }}><button type="button" className="ghost" disabled={skip.isPending} onClick={() => skip.mutate()}>Skip the welcome</button></p>
    </section>
  );
}

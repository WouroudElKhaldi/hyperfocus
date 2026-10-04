import { BEST_TIMES, FOCUS_MINUTES, NEURO, PRONOUNS, SITUATIONS, STUDY_LEVELS, STUDY_YEARS, SUPPORTS, TONES, type AboutMeInput } from "@hyperfocus/shared";
import i18next from "i18next";
import type { ReactNode } from "react";

// "About me" (P5-14): what someone tells the app so the AI fits them: studies, situation, how their brain works,
// what helps, how replies should sound. The welcome guide shows one block per screen; Profile shows them all.
// Every question is optional and big-button, one tap to pick and one to unpick.

type Pick1<T extends readonly unknown[]> = T[number] | "";
export type AboutMe = {
  pronouns: Pick1<typeof PRONOUNS>; studyLevel: Pick1<typeof STUDY_LEVELS>; major: string; school: string; studyYear: Pick1<typeof STUDY_YEARS>;
  situation: Pick1<typeof SITUATIONS>; neuro: (typeof NEURO)[number][]; neuroNote: string; supports: (typeof SUPPORTS)[number][];
  tone: Pick1<typeof TONES>; bestTime: Pick1<typeof BEST_TIMES>; focusMins: number;
};
// every answer the API takes has a place here (a new one in AboutMeInput is a type error until it's added above)
const _sameKeys: Record<keyof AboutMeInput, true> = { pronouns: true, studyLevel: true, major: true, school: true, studyYear: true, situation: true, neuro: true, neuroNote: true, supports: true, tone: true, bestTime: true, focusMins: true } satisfies Record<keyof AboutMe, true>;
void _sameKeys;
export const EMPTY_ABOUT_ME: AboutMe = { pronouns: "", studyLevel: "", major: "", school: "", studyYear: "", situation: "", neuro: [], neuroNote: "", supports: [], tone: "", bestTime: "", focusMins: 0 };
/** The answers out of a saved profile. */
export const aboutMeOf = (p: Partial<Record<keyof AboutMe, unknown>> | undefined): AboutMe =>
  Object.fromEntries(Object.entries(EMPTY_ABOUT_ME).map(([k, v]) => [k, p?.[k as keyof AboutMe] ?? v])) as AboutMe;
/** Has the person told us anything beyond their name? (Today's "tell us about you" card hides once they have.) */
export const saidAnything = (a: AboutMe) => Object.entries(a).some(([, v]) => (Array.isArray(v) ? v.length > 0 : !!v));

type Props = { value: AboutMe; set: (patch: Partial<AboutMe>) => void };
const t = (k: string) => i18next.t(`aboutme.${k}` as "aboutme.save");

/** A row of buttons: pick one (tap again to unpick). */
function One<T extends string | number>({ label, options, value, onPick, name }: { label: string; options: readonly T[]; value: T; onPick: (v: T) => void; name: (v: T) => string }) {
  return (
    <fieldset className="aboutme-q">
      <legend>{label}</legend>
      <div className="chip-row">
        {options.map((o) => (
          <button key={String(o)} type="button" className={`trait${value === o ? " on" : ""}`} aria-pressed={value === o} onClick={() => onPick(value === o ? ((typeof o === "number" ? 0 : "") as T) : o)}>{name(o)}</button>
        ))}
      </div>
    </fieldset>
  );
}

/** A row of buttons: pick any. */
function Some({ label, hint, options, value, onChange, name }: { label: string; hint?: ReactNode; options: readonly string[]; value: string[]; onChange: (v: string[]) => void; name: (v: string) => string }) {
  return (
    <fieldset className="aboutme-q">
      <legend>{label}</legend>
      {hint && <p className="muted tiny">{hint}</p>}
      <div className="chip-row">
        {options.map((o) => {
          const on = value.includes(o);
          return <button key={o} type="button" className={`trait${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>{name(o)}</button>;
        })}
      </div>
    </fieldset>
  );
}

export function PronounsQuestion({ value, set }: Props) {
  return <One label={t("pronouns")} options={PRONOUNS} value={value.pronouns as (typeof PRONOUNS)[number] | ""} name={(v) => t(`pr_${v}`)} onPick={(v) => set({ pronouns: v })} />;
}

export function StudyQuestions({ value, set, majorPicker }: Props & { majorPicker?: ReactNode }) {
  const studying = value.studyLevel && value.studyLevel !== "none";
  return (
    <>
      <One label={t("studyLevel")} options={STUDY_LEVELS} value={value.studyLevel as (typeof STUDY_LEVELS)[number] | ""} name={(v) => t(`lv_${v}`)} onPick={(v) => set({ studyLevel: v })} />
      {studying && (
        <>
          {majorPicker}
          <div className="field">
            <label htmlFor="aboutme-major">{t("major")}</label>
            <input id="aboutme-major" maxLength={100} placeholder={t("majorHint")} value={value.major} onChange={(e) => set({ major: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="aboutme-school">{t("school")}</label>
            <input id="aboutme-school" maxLength={100} placeholder={t("schoolHint")} value={value.school} onChange={(e) => set({ school: e.target.value })} />
          </div>
          <One label={t("studyYear")} options={STUDY_YEARS} value={value.studyYear as (typeof STUDY_YEARS)[number] | ""} name={(v) => (v === "last" ? t("yearLast") : v)} onPick={(v) => set({ studyYear: v })} />
        </>
      )}
    </>
  );
}

export function SituationQuestion({ value, set }: Props) {
  return <One label={t("situation")} options={SITUATIONS} value={value.situation as (typeof SITUATIONS)[number] | ""} name={(v) => t(`si_${v}`)} onPick={(v) => set({ situation: v })} />;
}

export function BrainQuestions({ value, set }: Props) {
  return (
    <>
      <p className="aboutme-private" role="note">🔒 {t("brainPrivate")}</p>
      <Some label={t("brain")} hint={t("brainHint")} options={NEURO} value={value.neuro} name={(v) => t(`ne_${v}`)} onChange={(neuro) => set({ neuro: neuro as AboutMe["neuro"] })} />
      <div className="field">
        <label htmlFor="aboutme-neuro-note">{t("brainNote")}</label>
        <textarea id="aboutme-neuro-note" rows={2} maxLength={300} placeholder={t("brainNoteHint")} value={value.neuroNote} onChange={(e) => set({ neuroNote: e.target.value })} />
      </div>
      <Some label={t("supports")} options={SUPPORTS} value={value.supports} name={(v) => t(`su_${v}`)} onChange={(supports) => set({ supports: supports as AboutMe["supports"] })} />
    </>
  );
}

export function StyleQuestions({ value, set }: Props) {
  return (
    <>
      <One label={t("tone")} options={TONES} value={value.tone as (typeof TONES)[number] | ""} name={(v) => t(`to_${v}`)} onPick={(v) => set({ tone: v })} />
      <One label={t("bestTime")} options={BEST_TIMES} value={value.bestTime as (typeof BEST_TIMES)[number] | ""} name={(v) => t(`bt_${v}`)} onPick={(v) => set({ bestTime: v })} />
      <One label={t("focusMins")} options={FOCUS_MINUTES} value={value.focusMins as (typeof FOCUS_MINUTES)[number] | 0} name={(v) => i18next.t("aboutme.minutes", { n: v })} onPick={(v) => set({ focusMins: v })} />
    </>
  );
}

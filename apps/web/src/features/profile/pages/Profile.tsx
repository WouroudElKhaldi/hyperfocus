import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { type FormEvent, useEffect, useState } from "react";
import { useToast } from "../../../App.tsx";
import { type AboutMe, aboutMeOf, BrainQuestions, PronounsQuestion, SituationQuestion, StudyQuestions, StyleQuestions } from "../../../components/AboutMe.tsx";
import { initialsOf, useProfile, useSaveProfile } from "../hooks/useProfile.ts";
import { PALETTE_GROUPS, type Palette, paletteTokens } from "../../../palettes.ts";
import type { Profile as ProfileData } from "../../../types.ts";
import { getPalette, setPalette } from "../../../theme.ts";

const FIELDS = ["name", "role", "location", "email", "linkedin", "about", "helps", "avatar"] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const formOf = (p: ProfileData) => Object.fromEntries(FIELDS.map((k) => [k, p[k] ?? ""] as const)) as Form;

// P5-14: the welcome guide's questions, to fill in or change any time (also for people who skipped the guide)
function AboutMeCard({ saved }: { saved: ProfileData }) {
  const toast = useToast();
  const saveProfile = useSaveProfile();
  const [a, setA] = useState<AboutMe>(() => aboutMeOf(saved));
  const set = (patch: Partial<AboutMe>) => setA((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(a) !== JSON.stringify(aboutMeOf(saved));
  return (
    <form id="about-me" className="card aboutme-card" aria-labelledby="aboutme-h" onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(a, { onSuccess: () => toast(i18next.t("aboutme.saved")) }); }}>
      <h2 id="aboutme-h">{i18next.t("aboutme.cardTitle")}</h2>
      <p className="muted">{i18next.t("aboutme.cardIntro")}</p>
      <PronounsQuestion value={a} set={set} />
      <StudyQuestions value={a} set={set} />
      <SituationQuestion value={a} set={set} />
      <BrainQuestions value={a} set={set} />
      <StyleQuestions value={a} set={set} />
      <button type="submit" className="primary big" disabled={!dirty || saveProfile.isPending}>{saveProfile.isPending ? i18next.t("profile.saving") : i18next.t("aboutme.save")}</button>
    </form>
  );
}

export default function Profile() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const saved = useProfile();
  const [f, setF] = useState<Form | null>(null);
  const saveProfile = useSaveProfile();
  const busy = saveProfile.isPending;
  const [palette, setPal] = useState(getPalette());

  useEffect(() => { if (saved && !f) setF(formOf(saved)); }, [saved]);

  if (!f) return <div className="empty">{i18next.t("profile.loading")}</div>;
  const set = (p: Partial<Form>) => setF((x) => (x ? { ...x, ...p } : x));
  const dirty = FIELDS.some((k) => (saved?.[k] ?? "") !== f[k]);

  const pick = (p: Palette) => {
    setPalette(p.id);
    setPal(p.id);
    set({ avatar: paletteTokens(p, "light")["--accent"] ?? f.avatar }); // your avatar takes the new color (saved with Save)
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    saveProfile.mutate(f, { onSuccess: () => toast(i18next.t("profile.savedYourInfoStays")) });
  };

  return (
    <>
      <h1>{i18next.t("profile.yourProfile")}</h1>
      <p className="sub">{i18next.t("profile.yourInfoSavedOn")}</p>

      <form className="profile-grid" onSubmit={save}>
        <div className="card profile-card">
          <div className="avatar big-avatar" style={{ background: f.avatar }} aria-hidden="true">{initialsOf(f.name)}</div>
          <h2 style={{ marginBottom: 0 }}>{f.name || i18next.t("profile.yourName")}</h2>
          <p className="muted">{[f.role, f.location].filter(Boolean).join(" · ") || "Role and place"}</p>
          <p className="muted tiny">{i18next.t("profile.yourColorFollowsThe")}</p>
          {f.linkedin && <a className="btn" href={f.linkedin} target="_blank" rel="noopener noreferrer">{i18next.t("profile.openLinkedin")}</a>}
        </div>

        <div className="card profile-fields">
          <div className="form-grid">
            <label>{i18next.t("profile.name")}<input id="pf-name" maxLength={60} placeholder={i18next.t("profile.whatShouldICall")} value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <label>{i18next.t("profile.whatYouDo")}<input id="pf-role" maxLength={80} placeholder={i18next.t("profile.eGSoftwareEngineer")} value={f.role} onChange={(e) => set({ role: e.target.value })} /></label>
            <label>{i18next.t("profile.whereYouAre")}<input id="pf-loc" maxLength={80} placeholder={i18next.t("profile.cityCountry")} value={f.location} onChange={(e) => set({ location: e.target.value })} /></label>
            <label>{i18next.t("profile.emailOptional")}<input id="pf-email" type="email" maxLength={120} placeholder={i18next.t("profile.youExampleCom")} value={f.email} onChange={(e) => set({ email: e.target.value })} /></label>
          </div>
          <label>{i18next.t("profile.linkedinLinkOptional")}<input id="pf-li" type="url" maxLength={200} placeholder={i18next.t("profile.httpsWwwLinkedinCom")} value={f.linkedin} onChange={(e) => set({ linkedin: e.target.value })} /></label>
          <label>{i18next.t("profile.aboutYou")}<textarea id="pf-about" rows={3} maxLength={600} placeholder={i18next.t("profile.aFewLinesWhat")} value={f.about} onChange={(e) => set({ about: e.target.value })} /></label>
          <label>{i18next.t("profile.whatHelpsYou")}
            <textarea id="pf-helps" rows={4} maxLength={800} placeholder={i18next.t("profile.howYouWorkBest")} value={f.helps} onChange={(e) => set({ helps: e.target.value })} />
          </label>
          <p className="muted tiny">{i18next.t("profile.whatHelpsYouAnd")}</p>
          <div className="row">
            <button className="primary big" disabled={!dirty || busy}>{busy ? i18next.t("profile.saving") : i18next.t("profile.save")}</button>
            {!dirty && saved?.updatedAt && <span className="muted tiny">Saved {new Date(saved.updatedAt).toLocaleDateString([], { day: "numeric", month: "short" })}</span>}
          </div>
        </div>
      </form>

      {saved && <AboutMeCard saved={saved} />}

      <section className="card theme-card" aria-labelledby="theme-h">
        <h2 id="theme-h">{i18next.t("profile.siteColor")}</h2>
        <p className="muted">{i18next.t("profile.pickTheMainColor")}</p>
        {PALETTE_GROUPS.map((g) => (
          <div key={g.id} className="theme-group">
            <h3>{g.label}</h3>
            <div className="swatches" role="radiogroup" aria-label={g.label}>
              {g.palettes.map((p) => (
                <button type="button" key={p.id} role="radio" aria-checked={palette === p.id} className={"swatch-named" + (palette === p.id ? " on" : "")} onClick={() => pick(p)}>
                  <span className="swatch-dot" style={{ background: p.light }} aria-hidden="true" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

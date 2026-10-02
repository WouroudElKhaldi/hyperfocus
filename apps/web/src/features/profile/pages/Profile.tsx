import { type FormEvent, useEffect, useState } from "react";
import { api, errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import { initialsOf, setProfileCache, useProfile } from "../hooks/useProfile.ts";
import { PALETTE_GROUPS, type Palette, paletteTokens } from "../../../palettes.ts";
import type { Profile as ProfileData } from "../../../types.ts";
import { getPalette, setPalette } from "../../../theme.ts";

const FIELDS = ["name", "role", "location", "email", "linkedin", "about", "helps", "avatar"] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const formOf = (p: ProfileData) => Object.fromEntries(FIELDS.map((k) => [k, p[k] ?? ""] as const)) as Form;

export default function Profile() {
  const toast = useToast();
  const saved = useProfile();
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [palette, setPal] = useState(getPalette());

  useEffect(() => { if (saved && !f) setF(formOf(saved)); }, [saved]);

  if (!f) return <div className="empty">Loading…</div>;
  const set = (p: Partial<Form>) => setF((x) => (x ? { ...x, ...p } : x));
  const dirty = FIELDS.some((k) => (saved?.[k] ?? "") !== f[k]);

  const pick = (p: Palette) => {
    setPalette(p.id);
    setPal(p.id);
    set({ avatar: paletteTokens(p, "light")["--accent"] ?? f.avatar }); // your avatar takes the new color (saved with Save)
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api.put("/profile", f);
      setProfileCache(p);
      toast("Saved. Your info stays on this computer.");
    } catch (caught) { const err = errorOf(caught); toast(err.message, "err"); }
    setBusy(false);
  };

  return (
    <>
      <h1>Your profile</h1>
      <p className="sub">Your info, saved on this computer. There's no account and no login. Only you see it, and it's included in your backups.</p>

      <form className="profile-grid" onSubmit={save}>
        <div className="card profile-card">
          <div className="avatar big-avatar" style={{ background: f.avatar }} aria-hidden="true">{initialsOf(f.name)}</div>
          <h2 style={{ marginBottom: 0 }}>{f.name || "Your name"}</h2>
          <p className="muted">{[f.role, f.location].filter(Boolean).join(" · ") || "Role and place"}</p>
          <p className="muted tiny">Your color follows the site theme below.</p>
          {f.linkedin && <a className="btn" href={f.linkedin} target="_blank" rel="noopener noreferrer">Open LinkedIn</a>}
        </div>

        <div className="card profile-fields">
          <div className="form-grid">
            <label>Name<input id="pf-name" maxLength={60} placeholder="What should I call you?" value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <label>What you do<input id="pf-role" maxLength={80} placeholder="e.g. Software engineer" value={f.role} onChange={(e) => set({ role: e.target.value })} /></label>
            <label>Where you are<input id="pf-loc" maxLength={80} placeholder="City, country" value={f.location} onChange={(e) => set({ location: e.target.value })} /></label>
            <label>Email (optional)<input id="pf-email" type="email" maxLength={120} placeholder="you@example.com" value={f.email} onChange={(e) => set({ email: e.target.value })} /></label>
          </div>
          <label>LinkedIn link (optional)<input id="pf-li" type="url" maxLength={200} placeholder="https://www.linkedin.com/in/…" value={f.linkedin} onChange={(e) => set({ linkedin: e.target.value })} /></label>
          <label>About you<textarea id="pf-about" rows={3} maxLength={600} placeholder="A few lines: what you do, what you're working toward." value={f.about} onChange={(e) => set({ about: e.target.value })} /></label>
          <label>What helps you
            <textarea id="pf-helps" rows={4} maxLength={800} placeholder="How you work best, what overwhelms you, what kind of words help when you're stuck. For example: “Tiny steps help. Please don't tell me to just focus.”" value={f.helps} onChange={(e) => set({ helps: e.target.value })} />
          </label>
          <p className="muted tiny">“What helps you” and “About you” are shared only with the AI companion, so its replies fit you. Nothing is sent anywhere else.</p>
          <div className="row">
            <button className="primary big" disabled={!dirty || busy}>{busy ? "Saving…" : "Save"}</button>
            {!dirty && saved?.updatedAt && <span className="muted tiny">Saved {new Date(saved.updatedAt).toLocaleDateString([], { day: "numeric", month: "short" })}</span>}
          </div>
        </div>
      </form>

      <section className="card theme-card" aria-labelledby="theme-h">
        <h2 id="theme-h">Site color</h2>
        <p className="muted">Pick the main color of the whole site. It works in both light and dark mode, and your choice stays on this device.</p>
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

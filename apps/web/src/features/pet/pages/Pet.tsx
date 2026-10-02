import { useEffect, useMemo, useState } from "react";
import { api, errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import PetArt from "../components/PetArt.tsx";
import Wardrobe, { type WardrobeChange } from "../components/Wardrobe.tsx";
import type { Outfit, PetCatalog, PetResponse, PetState, Personality } from "../../../types.ts";

/** The fields of the create / edit form. */
type PetFormValues = {
  name: string; gender: string; species: string; color: string; traits: string[]; bio: string; outfit: Outfit; backdrop: string; pattern: string; aura: string;
};
import { MOOD_VOICE, VOICE } from "../../../data/personalities.ts";

const SPECIES = [
  { id: "cat", label: "Cat" }, { id: "fox", label: "Fox" }, { id: "bunny", label: "Bunny" },
  { id: "dragon", label: "Dragon" }, { id: "blob", label: "Axolotl" },
];
const GENDERS = [{ id: "boy", label: "Boy" }, { id: "girl", label: "Girl" }, { id: "neutral", label: "Either" }];
const COLORS = ["#9b7bff", "#ff8fb8", "#ffb27a", "#62d6a8", "#6cb8ff", "#ffd36b", "#ff7a7a", "#b07a5a", "#8d8fa8"] as const;
const SOURCE_LABEL: Record<string, string> = { task: "Task", step: "Goal step", goal: "Goal", post: "Post", study: "Study", win: "Win", review: "Review", skill: "Skill", book: "Book", quest: "Daily quest", add: "Added" };
const PERK_NAME: Record<string, string> = { task: "task points", study: "study points", step: "goal step points", goal: "goal points", post: "post points", win: "win points", review: "review points", skill: "skill level-up points", book: "book points" };
const perkText = (perk: Record<string, number>) => Object.entries(perk).map(([k, v]) => `+${v}% ${PERK_NAME[k]}`).join(", ");
const PRIORITY_LABEL: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

function sayings(s: PetState) {
  const pool: string[] = [];
  for (const t of s.pet.traits) pool.push(...(VOICE[t] || []), ...(VOICE[t] || []).slice(0, 2)); // their own voice is heard most
  pool.push(...(MOOD_VOICE[s.mood] || []));
  if (s.mood === "egg" && s.progress > 0.6) pool.push("I can see light through the shell!", "Almost there. Just a little more.");
  const last = s.recent[0]?.note;
  if (s.mood === "happy" && last) pool.push(`I felt that: "${last}"`);
  const h = new Date().getHours();
  if (s.mood !== "egg" && (h >= 23 || h < 5)) pool.push("It's late. Sleep counts as progress too.");
  return pool;
}

function PersonalityPicker({ list, value, max, onChange }: { list: Personality[]; value: string[]; max: number; onChange: (traits: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length < max ? [...value, id] : value);
  return (
    <div className="field">
      <span className="field-label">Personality <span className="muted tiny">({value.length} of {max} picked)</span></span>
      <div className="pers-grid">
        {list.map((p) => (
          <button type="button" key={p.id} className={"pers" + (value.includes(p.id) ? " on" : "")} aria-pressed={value.includes(p.id)} onClick={() => toggle(p.id)} disabled={!value.includes(p.id) && value.length >= max}>
            <b>{p.title}</b>
            <span className="muted tiny">{p.desc}</span>
            <span className="perk">{perkText(p.perk)}</span>
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div className="pers-sum">
          <b>What they do</b>
          {value.map((id) => {
            const p = list.find((x) => x.id === id);
            return p && <div key={id} className="pers-line"><span className="trait on static">{p.label}</span><span>says things like “{(VOICE[id] || [""])[0]}”</span><span className="perk">{perkText(p.perk)}</span></div>;
          })}
          <p className="muted tiny">Each one changes how your pet talks and gives a small bonus on one kind of progress (up to +30% in total). The bonus applies to points earned from then on.</p>
        </div>
      )}
    </div>
  );
}

// Used to create the pet, and to edit its basic details later.
type PetFormProps = { initial: PetFormValues; catalog: PetCatalog; creating?: boolean; busy: boolean; onSubmit: (f: PetFormValues) => void };
function PetForm({ initial, catalog, creating, busy, onSubmit }: PetFormProps) {
  const [f, setF] = useState(initial);
  const [peek, setPeek] = useState(true);
  const set = (p: Partial<PetFormValues>) => setF((x) => ({ ...x, ...p }));
  const showAge = creating ? (peek ? 7 : 0) : 7;
  // switching gender takes off anything that doesn't fit the new one
  const setGender = (gender: string) => setF((x) => {
    const fits = (id: string | undefined) => { const it = catalog.items.find((i) => i.id === id); return !it || !it.for || it.for === "all" || gender === "neutral" || it.for === gender; };
    return { ...x, gender, outfit: Object.fromEntries(Object.entries(x.outfit || {}).filter(([, id]) => fits(id))) };
  });

  return (
    <form className="pet-form" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <div className={`pet-stage bd-${f.backdrop || "meadow"}`}>
        <PetArt species={f.species} gender={f.gender} color={f.color} stage={showAge} mood={showAge === 0 ? "egg" : "happy"} outfit={f.outfit} pattern={f.pattern} aura={f.aura} size={220} />
        {creating && <button type="button" className="peek" onClick={() => setPeek(!peek)}>{peek ? "Show it as an egg" : "Show it grown up"}</button>}
      </div>

      <div className="pet-fields">
        <label>Name<input id="pet-name" maxLength={24} placeholder="What will you call it?" value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>

        <div className="field">
          <span className="field-label">Boy or girl? <span className="muted tiny">(changes how it looks and which clothes fit)</span></span>
          <div className="seg" role="radiogroup" aria-label="Boy or girl">
            {GENDERS.map((g) => <button type="button" key={g.id} role="radio" aria-checked={f.gender === g.id} className={f.gender === g.id ? "on" : ""} onClick={() => setGender(g.id)}>{g.label}</button>)}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Kind</span>
          <div className="pick-row">
            {SPECIES.map((s) => (
              <button type="button" key={s.id} className={"pick" + (f.species === s.id ? " on" : "")} onClick={() => set({ species: s.id })} aria-pressed={f.species === s.id}>
                <PetArt species={s.id} gender={f.gender} color={f.color} stage={6} mood="happy" size={58} animate={false} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Color</span>
          <div className="swatches">
            {COLORS.map((c) => <button type="button" key={c} className={"swatch" + (f.color === c ? " on" : "")} style={{ background: c }} onClick={() => set({ color: c })} aria-label={`Color ${c}`} />)}
            <label className="swatch custom" title="Pick any color"><input type="color" value={f.color} onChange={(e) => set({ color: e.target.value })} aria-label="Custom color" /></label>
          </div>
        </div>

        <PersonalityPicker list={catalog.personalities} value={f.traits} max={catalog.maxTraits} onChange={(traits) => set({ traits })} />

        <label>About {f.name || "your pet"}<textarea id="pet-bio" rows={2} maxLength={200} placeholder="Favorite snack, a little backstory, anything you like" value={f.bio} onChange={(e) => set({ bio: e.target.value })} /></label>

        {creating && (
          <div className="field">
            <span className="field-label">Outfit and looks <span className="muted tiny">(more unlock as it grows)</span></span>
            <Wardrobe data={catalog} pet={{ species: f.species, color: f.color, gender: f.gender }} age={0} outfit={f.outfit} backdrop={f.backdrop} pattern={f.pattern} aura={f.aura}
              onChange={(p) => set({ ...(p.outfit ? { outfit: Object.fromEntries(Object.entries(p.outfit).filter(([, v]) => v)) } : {}), ...(p.backdrop ? { backdrop: p.backdrop } : {}), ...(p.pattern ? { pattern: p.pattern } : {}), ...(p.aura ? { aura: p.aura } : {}) })} />
          </div>
        )}

        <button className="primary big" disabled={busy || !f.name.trim()}>{busy ? "Saving…" : creating ? "Start with an egg" : "Save changes"}</button>
      </div>
    </form>
  );
}

export default function Pet() {
  const toast = useToast();
  const [s, setS] = useState<PetResponse | undefined>(undefined); // undefined = loading, {pet:null} = no pet yet
  const [catalog, setCatalog] = useState<PetCatalog | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [jump, setJump] = useState(0);

  const load = () => api.get("/pet").then(setS).catch((e) => toast(e.message, "err"));
  useEffect(() => {
    load();
    window.addEventListener("data-changed", load);
    return () => window.removeEventListener("data-changed", load);
  }, []);
  useEffect(() => { if (s && !s.pet && !catalog) api.get("/pet/catalog").then(setCatalog).catch((e) => toast(e.message, "err")); }, [s?.pet]);

  const st = s?.pet ? s : null; // the pet's state once there is a pet
  const talk = useMemo(() => (st ? sayings(st) : []), [st?.xp, st?.mood, st?.pet.name, st?.pet.traits.join()]);
  const anyLine = () => talk[Math.floor(Math.random() * talk.length)] ?? "";
  useEffect(() => { if (talk.length) setSaid(anyLine()); }, [talk]);
  const poke = () => { if (talk.length) { setSaid(anyLine()); setJump((j) => j + 1); } };

  const create = async (f: PetFormValues) => {
    setBusy(true);
    try { setS(await api.post("/pet", f)); toast("An egg appeared 🥚 Keep going and it will hatch."); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };
  const patch = async (body: Partial<PetFormValues> | WardrobeChange, okMsg?: string) => {
    setBusy(true);
    try { setS(await api.patch("/pet", body)); if (okMsg) toast(okMsg); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };

  if (s === undefined) return <div className="empty">Waking things up…</div>;

  if (!s.pet) {
    return (
      <>
        <h1>Your companion</h1>
        <p className="sub">A friend that grows up as you finish things. It starts as an egg and ages through ten stages, looking different at each one. There's nothing to feed, and it never gets sad or sick. On quiet days it just rests.</p>
        {!catalog ? <div className="empty">Loading…</div> : (
          <div className="card">
            <PetForm creating catalog={catalog} busy={busy} onSubmit={create}
              initial={{ name: "", gender: "neutral", species: "cat", color: COLORS[0], traits: [], bio: "", outfit: {}, backdrop: "meadow", pattern: "none", aura: "none" }} />
          </div>
        )}
      </>
    );
  }

  const p = s.pet;
  const nextAge = s.ages[s.age + 1];
  const goalLabel = s.nextAt === null ? null : nextAge ? `${nextAge.name} at ${nextAge.at} points` : `Legend at ${s.legendAt} points`;
  const unlockedBadges = s.badges.filter((b) => b.unlocked).length;
  const look = { species: p.species, gender: p.gender, color: p.color, outfit: s.outfit, pattern: p.pattern, aura: p.aura };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{p.name}</h1>
          <p className="sub">{s.age === 0 ? `Waiting to hatch · day ${s.ageDays + 1}` : `Age ${s.age} · ${s.stageName}${s.legend ? " · Legend" : ""} · ${s.ageDays} day${s.ageDays === 1 ? "" : "s"} old`}</p>
        </div>
        <button onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit details"}</button>
      </div>

      {editing && (
        <div className="card">
          <PetForm catalog={s} busy={busy} onSubmit={async (f) => { await patch({ name: f.name, gender: f.gender, species: f.species, color: f.color, traits: f.traits, bio: f.bio }, "Saved"); setEditing(false); }}
            initial={{ name: p.name, gender: p.gender || "neutral", species: p.species, color: p.color, traits: p.traits, bio: p.bio, outfit: s.outfit, backdrop: p.backdrop, pattern: p.pattern, aura: p.aura }} />
        </div>
      )}

      <div className="pet-home">
        <div className={`card pet-hero bd-${p.backdrop}`}>
          <button className="pet-tap" key={jump} onClick={poke} aria-label={`Pet ${p.name}`}>
            <PetArt {...look} stage={s.stage} mood={s.mood} legend={s.legend} eggProgress={s.progress} size={250} className={jump ? "pet-jump" : ""} />
          </button>
          <div className="bubble" role="status">{said}</div>
        </div>

        <div className="stack">
          <div className="card pet-info">
            <div className="row between"><h2>Growth</h2><span className="chip">{s.xp} points</span></div>
            <div className="xpbar" role="progressbar" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${Math.round(s.progress * 100)}%` }} /></div>
            <p className="muted tiny">{goalLabel ? `${(s.nextAt ?? s.xp) - s.xp} points until ${goalLabel.split(" at ")[0]}` : "You reached the top. Keep going for the fun of it."}</p>
            <div className="pstats">
              {([["Streak", `${s.stats.streak}d`], ["Tasks", s.stats.tasks], ["Posts", s.stats.posts], ["Studied", `${Math.floor(s.stats.studyMinutes / 60)}h ${s.stats.studyMinutes % 60}m`]] as [string, string | number][]).map(([l, v]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
            </div>
          </div>

          <div className="card">
            <div className="row between"><h2>Today</h2><span className="chip">+{s.today.xp} points</span></div>
            {s.today.quests.map((q) => (
              <div key={q.id} className="quest">
                <span className={"quest-check" + (q.done ? " on" : "")} aria-hidden="true">{q.done ? "✓" : ""}</span>
                <span className="grow">{q.label}<span className="xpbar mini"><span style={{ width: `${(q.have / q.need) * 100}%` }} /></span></span>
                <span className="muted tiny">{q.done ? `+${q.bonus} earned` : `${q.have}/${q.need} · +${q.bonus}`}</span>
              </div>
            ))}
            <p className="muted tiny">{s.today.allDone ? `All three done. +${s.today.allBonus} bonus earned!` : `Finish all three for +${s.today.allBonus} more.`}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row between wrap"><h2>{p.name}'s personality</h2>{Object.keys(s.perks).length > 0 && <span className="perk">{perkText(s.perks)}</span>}</div>
        {p.traits.length === 0 && <p className="muted">No personality picked yet. Use “Edit details” to choose up to {s.maxTraits}.</p>}
        <div className="pers-list">
          {p.traits.map((id) => {
            const t = s.personalities.find((x) => x.id === id);
            return t && (
              <div key={id} className="pers-line big">
                <span className="trait on static">{t.title}</span>
                <span className="grow muted">{t.desc} <i>“{(VOICE[id] || [""])[0]}”</i></span>
                <span className="perk">{perkText(t.perk)}</span>
              </div>
            );
          })}
        </div>
        {p.bio && <p className="pre" style={{ marginTop: "var(--s-2)" }}>{p.bio}</p>}
      </div>

      <div className="card">
        <h2>Wardrobe <span className="muted tiny">Clothes, jewelry and looks unlock as you study, finish things and earn points.</span></h2>
        <Wardrobe data={s} pet={p} age={s.age} outfit={s.outfit} backdrop={p.backdrop} pattern={p.pattern} aura={p.aura} busy={busy}
          onChange={(change) => patch(change.outfit ? { outfit: Object.fromEntries(Object.entries(change.outfit).filter(([, v]) => v)) } : change)} />
      </div>

      <div className="card">
        <h2>Growing up <span className="muted tiny">{p.name} looks different at every age.</span></h2>
        <div className="ages">
          {s.ages.map((a) => (
            <div key={a.age} className={"age-card" + (a.age === s.age ? " now" : a.age < s.age ? " past" : " future")}>
              <PetArt {...look} stage={a.age} mood="happy" size={88} animate={false} eggProgress={0.4} />
              <b>{a.name}</b>
              <span className="muted tiny">{a.age === s.age ? "Right now" : `${a.at} points`}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Badges <span className="muted tiny">{unlockedBadges} of {s.badges.length}</span></h2>
          <div className="badges">
            {s.badges.map((b) => (
              <div key={b.id} className={"badge" + (b.unlocked ? " on" : "")} title={b.desc}>
                <div className="badge-ico" aria-hidden="true">{b.unlocked ? "★" : "☆"}</div>
                <b>{b.label}</b>
                <span className="muted tiny">{b.unlocked ? b.desc : `${b.have}/${b.need} · ${b.desc}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Recently earned</h2>
            {s.recent.length === 0 && <p className="muted">Nothing yet. Finish something small and {p.name} will notice.</p>}
            {s.recent.map((r, i) => (
              <div className="xp-row" key={i}><span className="xp-amt">+{r.amount}</span><span className="grow">{r.note || SOURCE_LABEL[r.source]}</span><span className="muted tiny">{SOURCE_LABEL[r.source]}</span></div>
            ))}
          </div>
          <div className="card">
            <h2>How points work</h2>
            <p className="muted tiny">More important things earn more. Each thing counts once.</p>
            <h3>Tasks, by importance</h3>
            {Object.entries(s.points.priority).map(([k, v]) => <div className="xp-row" key={k}><span className="xp-amt">+{v}</span><span className="grow">{PRIORITY_LABEL[k]} task</span></div>)}
            <h3>Everything else</h3>
            {([["Reach a goal", s.points.other.goal], ["Publish a LinkedIn post", s.points.other.post], ["Finish a book", s.points.other.book], ["Do a weekly review", s.points.other.review], ["Finish a goal step", s.points.other.step], ["Level up a skill", s.points.other.skill], ["Log a win", s.points.other.win]] as [string, number | undefined][]).map(([l, v]) => <div className="xp-row" key={l}><span className="xp-amt">+{v}</span><span className="grow">{l}</span></div>)}
            <div className="xp-row"><span className="xp-amt">+1…50</span><span className="grow">Study: 1 per 3 minutes (up to 40), +10 for a 45+ minute session</span></div>
            <h3>Just for adding</h3>
            <div className="xp-row"><span className="xp-amt">+{s.points.capture.thought.xp}</span><span className="grow">Capture a thought (up to {s.points.capture.thought.cap} a day)</span></div>
            <div className="xp-row"><span className="xp-amt">+{s.points.capture.task.xp}</span><span className="grow">Plan a task (up to {s.points.capture.task.cap} a day)</span></div>
            <h3>Daily quests</h3>
            <div className="xp-row"><span className="xp-amt">+15</span><span className="grow">Each quest, and +{s.today.allBonus} for all three</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

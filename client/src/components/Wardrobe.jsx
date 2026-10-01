import { useState } from "react";
import PetArt from "./PetArt.jsx";

const TABS = [
  { id: "head", label: "Head" },
  { id: "face", label: "Face" },
  { id: "neck", label: "Neck & jewelry" },
  { id: "body", label: "Clothes" },
  { id: "extra", label: "Extras" },
  { id: "look", label: "Looks" },
  { id: "scene", label: "Scene" },
];
const BD_PREVIEW = { meadow: "bd-meadow", night: "bd-night", sunrise: "bd-sunrise", candy: "bd-candy", beach: "bd-beach", space: "bd-space" };

function Progress({ have, need }) {
  return <span className="xpbar mini"><span style={{ width: `${Math.min(100, (have / Math.max(need, 1)) * 100)}%` }} /></span>;
}

// Clothes, jewelry and looks the pet can wear. Locked ones show what to do to earn them.
// `onChange` receives the new outfit / backdrop / pattern / aura, so this works both when choosing a pet and on its page.
export default function Wardrobe({ data, pet, age, outfit, backdrop, pattern, aura, onChange, busy }) {
  const gender = pet.gender || "neutral";
  const [tab, setTab] = useState("head");
  const previewAge = Math.max(age, 4);
  const base = { species: pet.species, gender, color: pet.color, stage: previewAge, mood: "happy", animate: false };

  const tile = ({ key, name, unlocked, label, have, need, worn, onPick, preview, extra }) => (
    <button key={key} type="button" className={"wd-item" + (worn ? " worn" : "") + (unlocked ? "" : " locked")} onClick={onPick} disabled={busy || (!unlocked && !worn)}
      aria-pressed={worn} title={unlocked ? (worn ? "Wearing it. Click to take off." : `Put on ${name}`) : `${name}: ${label}`}>
      <span className={"wd-prev " + (extra || "")}>{preview}</span>
      <b>{name}</b>
      {unlocked ? <span className="muted tiny">{worn ? "Wearing" : "Unlocked"}</span> : <><span className="muted tiny">{label}</span><Progress have={have} need={need} /></>}
    </button>
  );

  // items made for the other gender are hidden; "either" sees everything
  const slotItems = data.items.filter((i) => i.slot === tab && (!i.for || i.for === "all" || gender === "neutral" || i.for === gender));
  const setSlot = (slot, id) => onChange({ outfit: { ...outfit, [slot]: id || "" } });

  return (
    <div className="wardrobe">
      <div className="seg wd-tabs" role="tablist" aria-label="Wardrobe">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab !== "scene" ? (
        <div className="wd-grid">
          {tile({ key: "none", name: "Nothing", unlocked: true, worn: !outfit[tab], onPick: () => setSlot(tab, ""), preview: <PetArt {...base} outfit={{}} size={64} /> })}
          {slotItems.map((i) => tile({ key: i.id, name: i.name, unlocked: i.unlocked, label: i.label, have: i.have, need: i.need, worn: outfit[tab] === i.id, onPick: () => setSlot(tab, i.id), preview: <PetArt {...base} outfit={{ [tab]: i.id }} size={64} /> }))}
        </div>
      ) : (
        <div className="wd-looks">
          <h3>Backdrop</h3>
          <div className="wd-grid">
            {data.backdrops.map((b) => tile({ key: b.id, name: b.name, unlocked: b.unlocked, label: b.label, have: b.have, need: b.need, worn: backdrop === b.id, onPick: () => onChange({ backdrop: b.id }), extra: BD_PREVIEW[b.id], preview: <PetArt {...base} stage={Math.max(age, 2)} size={56} /> }))}
          </div>
          <h3>Body pattern</h3>
          <div className="wd-grid">
            {data.patterns.map((p) => tile({ key: p.id, name: p.name, unlocked: p.unlocked, label: p.label, have: p.have, need: p.need, worn: pattern === p.id, onPick: () => onChange({ pattern: p.id }), preview: <PetArt {...base} pattern={p.id} size={64} /> }))}
          </div>
          <h3>Aura</h3>
          <div className="wd-grid">
            {data.auras.map((a) => tile({ key: a.id, name: a.name, unlocked: a.unlocked, label: a.label, have: a.have, need: a.need, worn: aura === a.id, onPick: () => onChange({ aura: a.id }), preview: <PetArt {...base} aura={a.id} size={64} /> }))}
          </div>
        </div>
      )}
    </div>
  );
}

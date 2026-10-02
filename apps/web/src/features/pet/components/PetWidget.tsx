import { type CSSProperties, useEffect, useState } from "react";
import type { PetState } from "../../../types.ts";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { usePet } from "../hooks/usePet.ts";
import PetArt from "./PetArt.tsx";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } };

// The pet card in the sidebar.
export default function PetWidget({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const s = usePet();
  if (!s) return null;

  if (!s.pet) {
    return (
      <Link activeProps={{ className: "active" }} to="/pet" className={"pet-widget empty" + (compact ? " compact" : "")} title={t("pet.getTitle")}>
        <span className="pw-egg" aria-hidden="true">🥚</span>
        <span className="pw-text"><b>{t("pet.getTitle")}</b><small>{t("pet.getHint")}</small></span>
      </Link>
    );
  }
  const p = s.pet;
  return (
    <Link activeProps={{ className: "active" }} to="/pet" className={"pet-widget" + (compact ? " compact" : "")} title={`${p.name} · Age ${s.age} ${s.stageName} · ${s.xp} points`}>
      <PetArt species={p.species} gender={p.gender} color={p.color} stage={s.stage} mood={s.mood} outfit={s.outfit} pattern={p.pattern} aura={p.aura} legend={s.legend} eggProgress={s.progress} size={compact ? 40 : 48} />
      <span className="pw-text">
        <b translate="no">{p.name}</b>
        <small>{t("pet.ageLine", { age: s.age, xp: s.xp })}</small>
        <span className="xpbar mini"><span style={{ width: `${Math.round(s.progress * 100)}%` }} /></span>
      </span>
    </Link>
  );
}

// One global celebration: shows when the pet hatches or grows into a new form, once per new form.
export function PetCelebration() {
  const s = usePet();
  const [party, setParty] = useState<PetState | null>(null);

  useEffect(() => {
    if (!s?.pet) return;
    const seen = read("pet-stage-seen");
    if (seen === null) write("pet-stage-seen", s.stage); // first time we see this pet: just remember it
    else if (s.stage > Number(seen)) setParty(s);
  }, [s?.pet ? s.stage : null, s?.pet?.id]);

  // it counts as seen only once you close it, so a reload while it is showing never loses it
  const close = () => { if (party) write("pet-stage-seen", party.stage); setParty(null); };
  if (!party) return null;
  return (
    <div className="modal-bg party" onClick={close}>
      <div className="modal card party-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your pet grew">
        <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>
        <PetArt species={party.pet.species} gender={party.pet.gender} color={party.pet.color} stage={party.stage} mood="happy" outfit={party.outfit} pattern={party.pet.pattern} aura={party.pet.aura} legend={party.legend} size={200} />
        <h2>{party.stage === 1 ? `${party.pet.name} hatched!` : `${party.pet.name} grew up a little!`}</h2>
        <p className="muted">{party.stage === 1 ? "That's all the things you finished, coming to life." : `Now age ${party.age}: a ${party.stageName.toLowerCase()}. Look what you did.`}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link activeProps={{ className: "active" }} to="/pet" className="btn primary" onClick={close}>Say hi</Link>
          <button className="ghost" onClick={close}>Later</button>
        </div>
      </div>
    </div>
  );
}

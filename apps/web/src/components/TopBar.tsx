import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PetArt, usePet } from "../features/pet/index.ts";
import { initialsOf, useProfile } from "../features/profile/index.ts";
import { useA11y, useSaveSettings } from "../features/settings/index.ts";
import { effectiveTheme, setTheme } from "../theme.ts";
import Icon from "./Icon.tsx";

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export function ThemeSwitch() {
  const [t, setT] = useState(effectiveTheme());
  useEffect(() => {
    const sync = () => setT(effectiveTheme());
    window.addEventListener("theme-change", sync);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", sync);
    return () => { window.removeEventListener("theme-change", sync); mq?.removeEventListener?.("change", sync); };
  }, []);
  const dark = t === "dark";
  return (
    <button role="switch" aria-checked={dark} className={"theme-switch" + (dark ? " dark" : "")} onClick={() => setTheme(dark ? "light" : "dark")} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
      <span className="ts-ico sun"><Icon name="sun" size={15} /></span>
      <span className="ts-ico moon"><Icon name="moon" size={15} /></span>
      <span className="ts-thumb" />
      <span className="sr-only">{dark ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}

export default function TopBar({ collapsed, onToggleSidebar }: { collapsed: boolean; onToggleSidebar: () => void }) {
  const profile = useProfile();
  const focusMode = !!useA11y()?.focusMode;
  const saveSettings = useSaveSettings();
  const pet = usePet();
  const [gain, setGain] = useState(0);
  const lastXp = useRef<number | null>(null);

  // a little "+10 XP" floats up when something new is earned
  useEffect(() => {
    if (!pet?.pet) return;
    if (lastXp.current !== null && pet.xp > lastXp.current) {
      setGain(pet.xp - lastXp.current);
      const t = setTimeout(() => setGain(0), 3300);
      lastXp.current = pet.xp;
      return () => clearTimeout(t);
    }
    lastXp.current = pet.xp;
  }, [pet?.pet ? pet.xp : null, pet?.pet?.id]);

  const name = profile?.name?.trim();
  const today = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className="topbar">
      <button className="ghost icon-btn sb-toggle" onClick={onToggleSidebar} aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"} aria-pressed={collapsed} title="Toggle sidebar (Ctrl+B)">
        <Icon name="sidebar" size={19} />
      </button>

      <Link activeProps={{ className: "active" }} to="/" className="tb-brand" aria-label="Home"><span className="tb-brand-mark" aria-hidden="true" /><b>Hyperfocus</b></Link>

      <div className="tb-hello">
        <b>{greeting()}{name ? `, ${name}` : ""}</b>
        <small>{name ? today : <Link activeProps={{ className: "active" }} to="/profile">Add your name</Link>}</small>
      </div>

      {/* focus mode hides the sidebar; this is the way back, always on screen (P3-18) */}
      {focusMode && (
        <button className="ghost" onClick={() => saveSettings.mutate({ focusMode: false })} title="Show the sidebar again">
          Focus mode · Exit
        </button>
      )}

      <div className="tb-right">
        {pet && (pet.pet ? (
          <Link activeProps={{ className: "active" }} to="/pet" className="pet-chip" title={`${pet.pet.name} · Age ${pet.age} ${pet.stageName} · ${pet.xp} points`}>
            <PetArt species={pet.pet.species} gender={pet.pet.gender} color={pet.pet.color} stage={pet.stage} mood={pet.mood} outfit={pet.outfit} pattern={pet.pet.pattern} aura={pet.pet.aura} legend={pet.legend} eggProgress={pet.progress} size={38} animate={false} />
            <span className="pc-text">
              <b>{pet.xp} points</b>
              <small>{pet.pet.name} · Age {pet.age}</small>
            </span>
            <span className="xpbar mini pc-bar"><span style={{ width: `${Math.round(pet.progress * 100)}%` }} /></span>
            {gain > 0 && <span className="xp-float" aria-live="polite">+{gain}</span>}
          </Link>
        ) : (
          <Link activeProps={{ className: "active" }} to="/pet" className="pet-chip empty"><span aria-hidden="true">🥚</span><span className="pc-text"><b>Get a companion</b></span></Link>
        ))}
        <ThemeSwitch />
        <Link activeProps={{ className: "active" }} to="/profile" className="avatar" style={{ background: profile?.avatar || "#7447e6" }} title={name ? `${name}'s profile` : "Your profile"} aria-label="Your profile">
          {initialsOf(name)}
        </Link>
      </div>
    </header>
  );
}

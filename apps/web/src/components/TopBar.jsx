import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { usePet } from "../hooks/usePet.js";
import { initialsOf, useProfile } from "../hooks/useProfile.js";
import { effectiveTheme, setTheme } from "../theme.js";
import PetArt from "./PetArt.jsx";
import Icon from "./Icon.jsx";

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

export default function TopBar({ collapsed, onToggleSidebar }) {
  const profile = useProfile();
  const pet = usePet();
  const [gain, setGain] = useState(0);
  const lastXp = useRef(null);

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
  }, [pet?.xp, pet?.pet?.id]);

  const name = profile?.name?.trim();
  const today = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className="topbar">
      <button className="ghost icon-btn sb-toggle" onClick={onToggleSidebar} aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"} aria-pressed={collapsed} title="Toggle sidebar (Ctrl+B)">
        <Icon name="sidebar" size={19} />
      </button>

      <NavLink to="/" className="tb-brand" aria-label="Home"><span className="tb-brand-mark" aria-hidden="true" /><b>Hyperfocus</b></NavLink>

      <div className="tb-hello">
        <b>{greeting()}{name ? `, ${name}` : ""}</b>
        <small>{name ? today : <NavLink to="/profile">Add your name</NavLink>}</small>
      </div>

      <div className="tb-right">
        {pet && (pet.pet ? (
          <NavLink to="/pet" className="pet-chip" title={`${pet.pet.name} · Age ${pet.age} ${pet.stageName} · ${pet.xp} points`}>
            <PetArt species={pet.pet.species} gender={pet.pet.gender} color={pet.pet.color} stage={pet.stage} mood={pet.mood} outfit={pet.outfit} pattern={pet.pet.pattern} aura={pet.pet.aura} legend={pet.legend} eggProgress={pet.progress} size={38} animate={false} />
            <span className="pc-text">
              <b>{pet.xp} points</b>
              <small>{pet.pet.name} · Age {pet.age}</small>
            </span>
            <span className="xpbar mini pc-bar"><span style={{ width: `${Math.round(pet.progress * 100)}%` }} /></span>
            {gain > 0 && <span className="xp-float" aria-live="polite">+{gain}</span>}
          </NavLink>
        ) : (
          <NavLink to="/pet" className="pet-chip empty"><span aria-hidden="true">🥚</span><span className="pc-text"><b>Get a companion</b></span></NavLink>
        ))}
        <ThemeSwitch />
        <NavLink to="/profile" className="avatar" style={{ background: profile?.avatar || "#7447e6" }} title={name ? `${name}'s profile` : "Your profile"} aria-label="Your profile">
          {initialsOf(name)}
        </NavLink>
      </div>
    </header>
  );
}

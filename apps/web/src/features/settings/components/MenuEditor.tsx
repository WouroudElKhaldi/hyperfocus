import i18next from "i18next";
import type { MenuLayout } from "@hyperfocus/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/Icon.tsx";
import { ALL, type NavItem, NAV, standardLayout } from "../../../nav.ts";
import { useSaveSettings, useSettings } from "../api.ts";

// Your menu (P3-27, interview 1): hide pages, move them up and down or into another group, rename groups, add your own
// groups, or go back to the standard menu. Saved with your account, so your phone and your computer show the same menu.
// Every change applies at once. Buttons only (no dragging), so it works with a keyboard and a screen reader.

const byPath = new Map(ALL.map((i) => [i.to as string, i]));

/** Your layout with every page placed (a page added later goes to its usual group). */
function complete(layout: MenuLayout): MenuLayout {
  const groups = layout.groups.map((g) => ({ ...g, items: g.items.filter((p) => byPath.has(p)) }));
  const placed = new Set(groups.flatMap((g) => g.items));
  for (const g of NAV) {
    const rest = g.items.map((i) => i.to as string).filter((p) => !placed.has(p));
    if (!rest.length) continue;
    const home = groups.find((x) => x.id === g.group);
    if (home) home.items.push(...rest);
    else groups.push({ id: g.group, name: "", items: rest });
  }
  return { groups, hidden: layout.hidden.filter((p) => byPath.has(p)) };
}

export default function MenuEditor() {
  const { t } = useTranslation();
  const settings = useSettings().data;
  const save = useSaveSettings();
  const [newGroup, setNewGroup] = useState("");
  const layout = complete(settings?.menu ?? standardLayout());
  const apply = (next: MenuLayout) => save.mutate({ menu: next });
  const label = (i: NavItem) => t(`nav.${i.label}`);
  const groupName = (g: MenuLayout["groups"][number]) => g.name || (NAV.some((n) => n.group === g.id) ? t(`nav.groups.${g.id as "Plan"}`) : g.id);

  const move = (gi: number, ii: number, by: number) => {
    const groups = layout.groups.map((g) => ({ ...g, items: [...g.items] }));
    const items = groups[gi]?.items;
    if (!items) return;
    const j = ii + by;
    if (j < 0 || j >= items.length) return;
    [items[ii], items[j]] = [items[j] as string, items[ii] as string];
    apply({ ...layout, groups });
  };
  const moveTo = (path: string, to: string) =>
    apply({ ...layout, groups: layout.groups.map((g) => ({ ...g, items: g.id === to ? [...g.items.filter((p) => p !== path), path] : g.items.filter((p) => p !== path) })) });
  const toggle = (path: string) => apply({ ...layout, hidden: layout.hidden.includes(path) ? layout.hidden.filter((p) => p !== path) : [...layout.hidden, path] });
  const rename = (id: string, name: string) => apply({ ...layout, groups: layout.groups.map((g) => (g.id === id ? { ...g, name: name.slice(0, 30) } : g)) });
  const moveGroup = (gi: number, by: number) => {
    const groups = [...layout.groups];
    const j = gi + by;
    if (j < 0 || j >= groups.length) return;
    [groups[gi], groups[j]] = [groups[j] as MenuLayout["groups"][number], groups[gi] as MenuLayout["groups"][number]];
    apply({ ...layout, groups });
  };
  const addGroup = () => {
    const name = newGroup.trim().slice(0, 30);
    if (!name) return;
    let n = 1;
    while (layout.groups.some((g) => g.id === `g${n}`)) n++;
    apply({ ...layout, groups: [...layout.groups, { id: `g${n}`, name, items: [] }] });
    setNewGroup("");
  };
  const removeGroup = (id: string) => apply({ ...layout, groups: layout.groups.filter((g) => g.id !== id) });

  return (
    <section className="card" aria-labelledby="menu-editor">
      <h2 id="menu-editor">{i18next.t("settings.yourMenu")}</h2>
      <p className="muted">{i18next.t("settings.hidePagesYouDon")}</p>
      {layout.groups.map((g, gi) => (
        <fieldset key={g.id} className="menu-group" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "var(--s-2)", marginBottom: "var(--s-2)" }}>
          <legend className="sr-only">{groupName(g)}</legend>
          <div className="row" style={{ gap: 6 }}>
            <label htmlFor={`grp-${g.id}`} className="sr-only">{t("settings.menuGroupName", { name: groupName(g) })}</label>
            <input id={`grp-${g.id}`} className="grow" defaultValue={g.name} placeholder={groupName(g)} onBlur={(e) => { if (e.target.value !== g.name) rename(g.id, e.target.value); }} />
            <button type="button" className="ghost" aria-label={t("settings.menuGroupUp", { name: groupName(g) })} disabled={gi === 0} onClick={() => moveGroup(gi, -1)}>↑</button>
            <button type="button" className="ghost" aria-label={t("settings.menuGroupDown", { name: groupName(g) })} disabled={gi === layout.groups.length - 1} onClick={() => moveGroup(gi, 1)}>↓</button>
            {g.items.length === 0 && <button type="button" className="ghost" onClick={() => removeGroup(g.id)}>{i18next.t("settings.removeGroup")}</button>}
          </div>
          <ul className="plain" aria-label={t("settings.menuPagesIn", { name: groupName(g) })}>
            {g.items.map((p, ii) => {
              const item = byPath.get(p);
              if (!item) return null;
              const off = layout.hidden.includes(p);
              return (
                <li key={p} className="row" style={{ gap: 6, opacity: off ? 0.55 : 1 }}>
                  <Icon name={item.icon} size={16} />
                  <span className="grow">{label(item)}{off ? t("settings.menuHidden") : ""}</span>
                  <button type="button" className="ghost" aria-label={t("settings.menuItemUp", { name: label(item) })} disabled={ii === 0} onClick={() => move(gi, ii, -1)}>↑</button>
                  <button type="button" className="ghost" aria-label={t("settings.menuItemDown", { name: label(item) })} disabled={ii === g.items.length - 1} onClick={() => move(gi, ii, 1)}>↓</button>
                  <label className="sr-only" htmlFor={`to-${p}`}>{t("settings.menuGroupFor", { name: label(item) })}</label>
                  <select id={`to-${p}`} value={g.id} onChange={(e) => moveTo(p, e.target.value)}>
                    {layout.groups.map((x) => <option key={x.id} value={x.id}>{groupName(x)}</option>)}
                  </select>
                  {p !== "/" && <button type="button" className="ghost" aria-pressed={off} onClick={() => toggle(p)}>{off ? t("settings.menuShow", { name: label(item) }) : t("settings.menuHide", { name: label(item) })}</button>}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <form className="row" onSubmit={(e) => { e.preventDefault(); addGroup(); }}>
        <label htmlFor="new-group" className="sr-only">{i18next.t("settings.newGroup")}</label>
        <input id="new-group" className="grow" placeholder={i18next.t("settings.newGroupEG")} maxLength={30} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        <button type="submit" disabled={!newGroup.trim() || layout.groups.length >= 10}>{i18next.t("settings.addGroup")}</button>
        <button type="button" className="ghost" onClick={() => save.mutate({ menu: null })}>{i18next.t("settings.backToTheStandard")}</button>
      </form>
    </section>
  );
}

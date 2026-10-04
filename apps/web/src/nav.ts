import type { LinkProps } from "@tanstack/react-router";
import type { MenuLayout } from "@hyperfocus/shared";
import type { Strings } from "./i18n/en.ts";

// The menu, grouped by what you use it for. `tab` marks the shortcuts shown in the phone tab bar.
// (labels are word keys: the words themselves are in i18n/en.ts, P3-19)
export type NavItem = { to: LinkProps["to"] & string; icon: string; label: Exclude<keyof Strings["nav"], "groups" | "chatShort">; tab?: boolean; radar?: boolean };
export type NavGroup = { group: keyof Strings["nav"]["groups"]; items: NavItem[] };
export const NAV: NavGroup[] = [
  { group: "Plan", items: [
    { to: "/", icon: "today", label: "today", tab: true },
    { to: "/calendar", icon: "calendar", label: "calendar", tab: true },
    { to: "/tasks", icon: "tasks", label: "tasks", tab: true },
  ] },
  { group: "Grow", items: [
    { to: "/goals", icon: "goals", label: "goals" },
    { to: "/skills", icon: "skills", label: "skills" },
    { to: "/study", icon: "study", label: "study" },
    { to: "/books", icon: "books", label: "books" },
    { to: "/review", icon: "review", label: "review" },
  ] },
  { group: "Share", items: [
    { to: "/notes", icon: "thoughts", label: "notes" },
    { to: "/posts", icon: "posts", label: "posts" },
    { to: "/emails", icon: "mail", label: "emails" },
    { to: "/jobs", icon: "jobs", label: "jobs" },
    { to: "/radar", icon: "radar", label: "radar", radar: true }, // (admins only while it is tested)
  ] },
  { group: "You", items: [
    { to: "/chat", icon: "chat", label: "chat", tab: true },
    { to: "/pet", icon: "pet", label: "pet" },
    { to: "/wins", icon: "wins", label: "wins" },
    { to: "/profile", icon: "profile", label: "profile" },
    { to: "/backup", icon: "settings", label: "settings" },
  ] },
];
export const ALL = NAV.flatMap((g) => g.items);

/** A group of the menu as shown: a standard one (its words in i18n) or one you made and named (P3-27). */
export type StdGroup = keyof Strings["nav"]["groups"];
/** name: yours (null = the standard group's own words, std) */
export type ShownGroup = { id: string; name: string | null; std: StdGroup | null; items: NavItem[] };
const stdOf = (id: string): StdGroup | null => NAV.find((n) => n.group === id)?.group ?? null;

/**
 * The menu with your arrangement applied (P3-27): your groups and order, without the pages you hid. A page your layout
 * doesn't mention (a page added later) stays in its usual group, at the end. No layout = the standard menu.
 */
export function arrange(layout: MenuLayout | null | undefined): ShownGroup[] {
  const std = (g: NavGroup): ShownGroup => ({ id: g.group, name: null, std: g.group, items: g.items });
  if (!layout) return NAV.map(std);
  const byPath = new Map(ALL.map((i) => [i.to as string, i]));
  const hidden = new Set(layout.hidden);
  const placed = new Set<string>();
  const groups: ShownGroup[] = layout.groups.map((g) => {
    const items = g.items.map((p) => byPath.get(p)).filter((i): i is NavItem => !!i && !placed.has(i.to) && !!placed.add(i.to));
    const s = stdOf(g.id);
    return { id: g.id, name: g.name || (s ? null : g.id), std: s, items: items.filter((i) => !hidden.has(i.to)) };
  });
  // pages the layout doesn't place: in their usual group (made again if you removed it)
  for (const g of NAV) {
    const rest = g.items.filter((i) => !placed.has(i.to) && !hidden.has(i.to));
    if (!rest.length) continue;
    const home = groups.find((x) => x.id === g.group);
    if (home) home.items.push(...rest);
    else groups.push({ id: g.group, name: null, std: g.group, items: rest });
  }
  return groups;
}

/** The standard menu written as a layout: where the editor starts. */
export const standardLayout = (): MenuLayout => ({ groups: NAV.map((g) => ({ id: g.group, name: "", items: g.items.map((i) => i.to as string) })), hidden: [] });

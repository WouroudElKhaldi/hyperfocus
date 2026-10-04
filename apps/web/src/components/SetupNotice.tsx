import { Link } from "@tanstack/react-router";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useMe } from "../features/account/index.ts";

// "Set this up first", shown at the top of a page before anyone presses a button that can't work yet (owner,
// 2026-10-04: "do not wait until a user presses send to tell him"). One line per missing thing, each with the one
// place to fix it. Nothing shows when everything the page needs is ready.

export type Need = "profile" | "ai" | "gmail" | "linkedin";

/** What each page's buttons need (the AI also needs a filled-in profile, in cloud mode). Longest path first. */
const PAGE_NEEDS: [string, Need[]][] = [
  ["/chat", ["profile", "ai"]],
  ["/posts", ["profile", "ai", "linkedin"]],
  ["/emails", ["gmail", "profile", "ai"]],
  ["/tasks", ["profile", "ai"]],
  ["/goals", ["profile", "ai"]],
  ["/study", ["profile", "ai"]],
  ["/calendar", ["profile", "ai"]],
  ["/books", ["profile", "ai"]],
  ["/skills", ["profile", "ai"]],
  ["/review", ["profile", "ai"]],
  ["/notes", ["profile", "ai"]],
  ["/", ["profile", "ai"]],
];

export const needsFor = (path: string): Need[] => PAGE_NEEDS.find(([p]) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`)))?.[1] ?? [];

/** What isn't ready yet, of what this page needs. */
export function useMissing(needs: Need[]): Need[] {
  const me = useMe().data;
  if (!me) return [];
  const ready: Record<Need, boolean> = { profile: me.profileReady ?? true, ai: me.connected.ai, gmail: me.connected.email, linkedin: me.connected.linkedin };
  return needs.filter((n) => !ready[n]);
}

/** Can the AI be used right now (a key, and a filled-in profile in cloud mode)? For switching AI buttons off. */
export const useAiReady = () => useMissing(["profile", "ai"]).length === 0;

const FIX: Record<Need, { to: "/profile" | "/backup"; hash: string }> = {
  profile: { to: "/profile", hash: "you" },
  ai: { to: "/backup", hash: "connections" },
  gmail: { to: "/backup", hash: "connections" },
  linkedin: { to: "/backup", hash: "connections" },
};

export default function SetupNotice({ path }: { path: string }) {
  useTranslation(); // (re-renders when the language changes)
  const me = useMe().data;
  const missing = useMissing(needsFor(path));
  // (not during the welcome guide: one thing at a time, and the guide asks for the profile itself)
  if (!missing.length || (me && !me.onboarded)) return null;
  return (
    <aside className="setup-note" role="note" aria-labelledby="setup-note-h">
      <span aria-hidden="true" style={{ fontSize: "1.3rem" }}>🧩</span>
      <div>
        <b id="setup-note-h">{i18next.t("setup.title")}</b>
        <ul>
          {missing.map((n) => (
            <li key={n} className="row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
              <span>{i18next.t(`setup.${n}` as "setup.ai")}</span>
              <Link className="btn" to={FIX[n].to} hash={FIX[n].hash}>{i18next.t(`setup.${n}Fix` as "setup.aiFix")}</Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

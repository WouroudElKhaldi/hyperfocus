import { type KeyboardEvent, type PointerEvent, Suspense, createContext, lazy, useCallback, useContext, useEffect, useState } from "react";
import { BRAND } from "./brand.ts";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { api } from "./api.ts";
import { useTranslation } from "react-i18next";
import Icon from "./components/Icon.tsx";
import { ALL, arrange, type NavItem } from "./nav.ts";
import Stuck from "./components/Stuck.tsx";
import LanguageSwitch from "./components/LanguageSwitch.tsx";
import TopBar, { ThemeSwitch } from "./components/TopBar.tsx";
import { PetCelebration, PetWidget } from "./features/pet/index.ts";
import { useA11y, useSettings } from "./features/settings/index.ts";
import { AccountPages, useMe } from "./features/account/index.ts";
import { Privacy } from "./features/settings/index.ts";
import Quotes from "./components/Quotes.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import type { Health } from "./types.ts";

// The music player loads the first time it is needed, so the app opens fast and stays light (pages: see router.tsx).
const MusicPlayer = lazy(() => import("./features/music/index.ts"));

/** Shows a short message at the bottom of the screen. "err" makes it an error. */
export type Toast = (msg: string, kind?: "ok" | "err") => void;
const ToastCtx = createContext<Toast>(() => {});
export const useToast = () => useContext(ToastCtx);

// one tab of the phone's bottom bar (P3-17)
const TAB = "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] bg-transparent px-0.5 py-1 text-[.68rem] font-semibold text-[var(--muted)] no-underline hover:bg-transparent hover:transform-none [&.active]:text-[var(--accent-strong)] [&_svg]:transition-transform [&_svg]:duration-200 [&.active_svg]:-translate-y-px [&.active_svg]:scale-[1.08] small:min-h-[52px] small:text-[.72rem] small:[&_svg]:size-6";

// Sidebar size and which groups are folded are remembered in this browser.
const SB = { min: 190, max: 380, def: 240, rail: 68 };
const clampW = (n: unknown) => Math.max(SB.min, Math.min(SB.max, Math.round(Number(n) || SB.def)));
const lsGet = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage may be unavailable */ } };
const inGroup = (g: { items: NavItem[] }, path: string) => g.items.some((i) => (i.to === "/" ? path === "/" : path === i.to || path.startsWith(i.to + "/")));

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="brand" title={`${BRAND.name}: ${BRAND.tagline}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--on-accent)" strokeWidth="2" opacity=".55" /><circle cx="16" cy="16" r="3.6" fill="var(--on-accent)" /><path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" /></svg>
      {!collapsed && <span>{BRAND.name}</span>}
    </div>
  );
}

// The root (P5-04): in cloud mode with nobody signed in, the sign-in pages; otherwise the app as always (local mode never
// signs in, so it goes straight to the app).
export default function App() {
  const me = useMe();
  if (me.isPending) return <div className="empty" role="status">Loading…</div>;
  if (me.data?.mode === "cloud" && !me.data.user) {
    // the privacy policy can be read before making an account (P5-12)
    if (window.location.pathname === "/privacy") return <main className="main signed-out-page"><Privacy signedOut /></main>;
    return <AccountPages google={me.data.google} onSignedIn={() => void me.refetch()} />;
  }
  return <Shell />;
}

function Shell() {
  const [toast, setToast] = useState<{ msg: string; kind: string; id: number } | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  // what works for you (your own keys, or the app's), P5-07; the server-wide health until it is known
  const meData = useMe().data;
  const connected = meData?.connected;
  // Job Radar is shown to those it is open to (admins while it is tested)
  const shown = (i: NavItem) => !i.radar || !!meData?.radar;
  // the menu as you arranged it (P3-27; the standard one until you do)
  const groups = arrange(useSettings().data?.menu);
  const [sheet, setSheet] = useState(false);
  useA11y(); // the accessibility settings (P3-18), kept in step with what is saved
  const [sbWidth, setSbWidth] = useState(() => clampW(lsGet("sb-width", SB.def)));
  const [collapsed, setCollapsed] = useState(() => lsGet<unknown>("sb-collapsed", false) === true);
  const [folded, setFolded] = useState<Record<string, boolean>>(() => lsGet("sb-folded", {})); // { Plan: true } means that group is folded
  const [resizing, setResizing] = useState(false);
  const location = useRouterState({ select: (s) => s.location });
  const { t } = useTranslation();

  const show = useCallback<Toast>((msg, kind = "ok") => {
    const id = Date.now();
    setToast({ msg, kind, id });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 4000);
  }, []);

  useEffect(() => { api.get("/health").then(setHealth).catch(() => setHealth({ ok: false })); }, []);
  useEffect(() => { setSheet(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => lsSet("sb-width", sbWidth), [sbWidth]);
  useEffect(() => lsSet("sb-collapsed", collapsed), [collapsed]);
  useEffect(() => lsSet("sb-folded", folded), [folded]);

  // opening a page unfolds the group it lives in, so you can always see where you are
  useEffect(() => {
    const g = groups.find((x) => inGroup(x, location.pathname));
    if (g && folded[g.id]) setFolded((f) => ({ ...f, [g.id]: false }));
  }, [location.pathname]);

  // Ctrl+B (or Cmd+B) collapses and expands the sidebar, unless you are typing
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startResize = (e: PointerEvent) => {
    e.preventDefault();
    setResizing(true);
    const move = (ev: globalThis.PointerEvent) => setSbWidth(clampW(ev.clientX));
    const up = () => { setResizing(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onHandleKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setSbWidth((w) => clampW(w - 16)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setSbWidth((w) => clampW(w + 16)); }
    if (e.key === "Home" || e.key === "Enter") { e.preventDefault(); setSbWidth(SB.def); }
  };

  const width = collapsed ? SB.rail : sbWidth;
  const allFolded = groups.every((g) => folded[g.id]);

  return (
    <ToastCtx.Provider value={show}>
      <a className="skip" href="#main">{t("shell.skip")}</a>
      <div className={"shell" + (resizing ? " resizing" : "") + (collapsed ? " is-collapsed" : "")}>
        <div className="sidebar-wrap phone:hidden" style={{ width }}>
          <aside className={"sidebar" + (collapsed ? " collapsed" : "")} aria-label={t("shell.sidebar")}>
            <Brand collapsed={collapsed} />
            {!collapsed && (
              <button className="ghost fold-all" onClick={() => setFolded(Object.fromEntries(groups.map((g) => [g.id, !allFolded])))}>
                {allFolded ? t("shell.unfoldAll") : t("shell.foldAll")}
              </button>
            )}
            <nav aria-label={t("shell.main")}>
              {groups.filter((g) => g.items.some(shown)).map((g) => {
                const isFolded = !collapsed && !!folded[g.id];
                return (
                  <div key={g.id} className="nav-group">
                    {collapsed ? <div className="nav-sep" aria-hidden="true" /> : (
                      <button className="nav-label" aria-expanded={!isFolded} onClick={() => setFolded((f) => ({ ...f, [g.id]: !f[g.id] }))}>
                        <Icon name="chevron" size={13} /> {g.name ?? t(`nav.groups.${g.std ?? "You"}`)}
                      </button>
                    )}
                    <div className={"nav-items" + (isFolded ? "" : " open")}>
                      <div className="nav-items-inner">
                        {g.items.filter(shown).map((i) => (
                          <Link key={i.to} to={i.to} activeOptions={{ exact: i.to === "/" }} className="nav" activeProps={{ className: "active" }} title={collapsed ? t(`nav.${i.label}`) : undefined} tabIndex={isFolded ? -1 : 0}>
                            <Icon name={i.icon} /> <span className="nav-text">{t(`nav.${i.label}`)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
            <div className="side-bottom">
              <PetWidget />
              <Stuck />
              <div className="status">
                {[
                  [health?.ok !== false, health?.ok === false ? "bad" : "ok", health?.ok === false ? t("shell.status.serverOff") : t("shell.status.serverOn")],
                  [!!(connected?.ai ?? health?.ai), (connected?.ai ?? health?.ai) ? "ok" : "off", (connected?.ai ?? health?.ai) ? t("shell.status.aiOn") : t("shell.status.aiOff")],
                  [!!(connected?.linkedin ?? health?.n8n), (connected?.linkedin ?? health?.n8n) ? "ok" : "off", (connected?.linkedin ?? health?.n8n) ? t("shell.status.n8nOn") : t("shell.status.n8nOff")],
                ].map(([, dot, text]) => (
                  <div key={String(text)} title={String(text)}><i className={`dot-s ${dot}`} /><span className="st-text">{text}</span></div>
                ))}
              </div>
            </div>
          </aside>
          {!collapsed && (
            <div className="resize-handle" role="separator" aria-orientation="vertical" aria-label={t("shell.resize")} aria-valuenow={sbWidth} aria-valuemin={SB.min} aria-valuemax={SB.max}
              tabIndex={0} onPointerDown={startResize} onKeyDown={onHandleKey} onDoubleClick={() => setSbWidth(SB.def)} />
          )}
        </div>

        <div className="content">
          {health?.demo && <div className="demo-banner" role="note">{t("shell.demo")}</div>}
          <TopBar collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
          <main className="main" id="main">
            <div className="page" key={location.pathname}>
              <Suspense fallback={<div className="empty">{t("shell.loading")}</div>}>
              <Outlet />
              </Suspense>
            </div>
          </main>
        </div>

        {/* phones only: the bottom tab bar and the "More" sheet (P3-17: Tailwind, was the phone layer in styles.css) */}
        <nav className="hidden phone:flex fixed inset-x-0 bottom-0 z-35 h-[calc(var(--tab-h)+env(safe-area-inset-bottom,0px))] border-t border-line bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-2 pt-2 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-[10px] small:pt-1" aria-label={t("shell.quickMenu")}>
          {ALL.filter((i) => i.tab && shown(i)).map((i) => (
            <Link key={i.to} to={i.to} activeOptions={{ exact: i.to === "/" }} className={TAB} activeProps={{ className: "active" }}>
              <Icon name={i.icon} size={22} /><span>{t(i.label === "chat" ? "nav.chatShort" : `nav.${i.label}`)}</span>
            </Link>
          ))}
          <button className={TAB + (sheet ? " active" : "")} onClick={() => setSheet(!sheet)} aria-expanded={sheet}>
            <Icon name="more" size={22} /><span>{t("shell.more")}</span>
          </button>
        </nav>

        {sheet && (
          <div className="hidden phone:block fixed inset-0 z-34 animate-[fade_.2s_both] bg-[rgba(28,18,60,.45)]" onClick={() => setSheet(false)}>
            <div className="card fixed inset-x-2 bottom-[calc(var(--tab-h)+8px+env(safe-area-inset-bottom,0px))] grid max-h-[72vh] animate-[slide-up_.25s_both] gap-2 overflow-y-auto small:max-h-[78vh] small:p-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("shell.allPages")}>
              <PetWidget compact />
              <div className="grid grid-cols-2 gap-1">
                {groups.flatMap((g) => g.items).filter(shown).map((i) => (
                  <Link key={i.to} to={i.to} activeOptions={{ exact: i.to === "/" }} className="nav border border-line bg-surface-2 [&.active]:bg-[var(--accent)] small:min-h-12 small:text-[1rem]" activeProps={{ className: "active" }}><Icon name={i.icon} /> <span>{t(`nav.${i.label}`)}</span></Link>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2 font-semibold text-ink-2"><span>{t("shell.lightOrDark")}</span><ThemeSwitch /></div>
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-3 py-2 font-semibold text-ink-2"><LanguageSwitch id="lang-sheet" /></div>
              <Stuck inline />
            </div>
          </div>
        )}

        <PetCelebration />
        <Quotes />
        <Suspense fallback={null}><MusicPlayer /></Suspense>
        <Toaster />
        {toast && <div key={toast.id} className={"toast " + toast.kind} role="status">{toast.msg}</div>}
      </div>
    </ToastCtx.Provider>
  );
}

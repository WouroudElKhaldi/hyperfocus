import { type KeyboardEvent, type PointerEvent, Suspense, createContext, lazy, useCallback, useContext, useEffect, useState } from "react";
import { BRAND } from "./brand.ts";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api.ts";
import Icon from "./components/Icon.tsx";
import Stuck from "./components/Stuck.tsx";
import TopBar, { ThemeSwitch } from "./components/TopBar.tsx";
import PetWidget, { PetCelebration } from "./components/PetWidget.tsx";
import Quotes from "./components/Quotes.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import type { Health } from "./types.ts";
import Today from "./pages/Today.tsx";
import Tasks from "./pages/Tasks.tsx";

// Pages and the music player load the first time they are needed, so the app opens fast and stays light.
const MusicPlayer = lazy(() => import("./components/MusicPlayer.tsx"));
const Notes = lazy(() => import("./pages/Notes.tsx"));
const Goals = lazy(() => import("./pages/Goals.tsx"));
const Skills = lazy(() => import("./pages/Skills.tsx"));
const Review = lazy(() => import("./pages/Review.tsx"));
const Wins = lazy(() => import("./pages/Wins.tsx"));
const Backup = lazy(() => import("./pages/Backup.tsx"));
const Books = lazy(() => import("./pages/Books.tsx"));
const BookDetail = lazy(() => import("./pages/BookDetail.tsx"));
const Study = lazy(() => import("./pages/Study.tsx"));
const Calendar = lazy(() => import("./pages/Calendar.tsx"));
const Posts = lazy(() => import("./pages/Posts.tsx"));
const PostEditor = lazy(() => import("./pages/PostEditor.tsx"));
const Emails = lazy(() => import("./pages/Emails.tsx"));
const EmailEditor = lazy(() => import("./pages/EmailEditor.tsx"));
const Jobs = lazy(() => import("./pages/Jobs.tsx"));
const JobDetail = lazy(() => import("./pages/JobDetail.tsx"));
const Chat = lazy(() => import("./pages/Chat.tsx"));
const Pet = lazy(() => import("./pages/Pet.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
// the design system page (P3-02): development only, so it never ships in the built app
const DevUi = import.meta.env.DEV ? lazy(() => import("./pages/DevUi.tsx")) : null;

/** Shows a short message at the bottom of the screen. "err" makes it an error. */
export type Toast = (msg: string, kind?: "ok" | "err") => void;
const ToastCtx = createContext<Toast>(() => {});
export const useToast = () => useContext(ToastCtx);

// The menu, grouped by what you use it for. `tab` marks the shortcuts shown in the phone tab bar.
type NavItem = { to: string; icon: string; label: string; tab?: boolean };
type NavGroup = { group: string; items: NavItem[] };
const NAV: NavGroup[] = [
  { group: "Plan", items: [
    { to: "/", icon: "today", label: "Today", tab: true },
    { to: "/calendar", icon: "calendar", label: "Calendar", tab: true },
    { to: "/tasks", icon: "tasks", label: "Tasks", tab: true },
  ] },
  { group: "Grow", items: [
    { to: "/goals", icon: "goals", label: "Goals" },
    { to: "/skills", icon: "skills", label: "Skills map" },
    { to: "/study", icon: "study", label: "Study log" },
    { to: "/books", icon: "books", label: "Books" },
    { to: "/review", icon: "review", label: "Weekly review" },
  ] },
  { group: "Share", items: [
    { to: "/notes", icon: "thoughts", label: "Thoughts & ideas" },
    { to: "/posts", icon: "posts", label: "LinkedIn posts" },
    { to: "/emails", icon: "mail", label: "Email" },
    { to: "/jobs", icon: "jobs", label: "Job applications" },
  ] },
  { group: "You", items: [
    { to: "/chat", icon: "chat", label: "Talk it out", tab: true },
    { to: "/pet", icon: "pet", label: "Companion" },
    { to: "/wins", icon: "wins", label: "Wins" },
    { to: "/profile", icon: "profile", label: "Profile" },
    { to: "/backup", icon: "settings", label: "Settings & backup" },
  ] },
];
const ALL = NAV.flatMap((g) => g.items);
const navCls = ({ isActive }: { isActive: boolean }) => "nav" + (isActive ? " active" : "");

// Sidebar size and which groups are folded are remembered in this browser.
const SB = { min: 190, max: 380, def: 240, rail: 68 };
const clampW = (n: unknown) => Math.max(SB.min, Math.min(SB.max, Math.round(Number(n) || SB.def)));
const lsGet = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage may be unavailable */ } };
const inGroup = (g: NavGroup, path: string) => g.items.some((i) => (i.to === "/" ? path === "/" : path === i.to || path.startsWith(i.to + "/")));

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="brand" title={`${BRAND.name}: ${BRAND.tagline}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--on-accent)" strokeWidth="2" opacity=".55" /><circle cx="16" cy="16" r="3.6" fill="var(--on-accent)" /><path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" /></svg>
      {!collapsed && <span>{BRAND.name}</span>}
    </div>
  );
}

export default function App() {
  const [toast, setToast] = useState<{ msg: string; kind: string; id: number } | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [sheet, setSheet] = useState(false);
  const [sbWidth, setSbWidth] = useState(() => clampW(lsGet("sb-width", SB.def)));
  const [collapsed, setCollapsed] = useState(() => lsGet<unknown>("sb-collapsed", false) === true);
  const [folded, setFolded] = useState<Record<string, boolean>>(() => lsGet("sb-folded", {})); // { Plan: true } means that group is folded
  const [resizing, setResizing] = useState(false);
  const location = useLocation();

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
    const g = NAV.find((x) => inGroup(x, location.pathname));
    if (g && folded[g.group]) setFolded((f) => ({ ...f, [g.group]: false }));
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
  const allFolded = NAV.every((g) => folded[g.group]);

  return (
    <ToastCtx.Provider value={show}>
      <a className="skip" href="#main">Skip to content</a>
      <div className={"shell" + (resizing ? " resizing" : "") + (collapsed ? " is-collapsed" : "")}>
        <div className="sidebar-wrap" style={{ width }}>
          <aside className={"sidebar" + (collapsed ? " collapsed" : "")} aria-label="Sidebar">
            <Brand collapsed={collapsed} />
            {!collapsed && (
              <button className="ghost fold-all" onClick={() => setFolded(Object.fromEntries(NAV.map((g) => [g.group, !allFolded])))}>
                {allFolded ? "Unfold all" : "Fold all"}
              </button>
            )}
            <nav aria-label="Main">
              {NAV.map((g) => {
                const isFolded = !collapsed && !!folded[g.group];
                return (
                  <div key={g.group} className="nav-group">
                    {collapsed ? <div className="nav-sep" aria-hidden="true" /> : (
                      <button className="nav-label" aria-expanded={!isFolded} onClick={() => setFolded((f) => ({ ...f, [g.group]: !f[g.group] }))}>
                        <Icon name="chevron" size={13} /> {g.group}
                      </button>
                    )}
                    <div className={"nav-items" + (isFolded ? "" : " open")}>
                      <div className="nav-items-inner">
                        {g.items.map((i) => (
                          <NavLink key={i.to} to={i.to} end={i.to === "/"} className={navCls} title={collapsed ? i.label : undefined} tabIndex={isFolded ? -1 : 0}>
                            <Icon name={i.icon} /> <span className="nav-text">{i.label}</span>
                          </NavLink>
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
                <div title={health?.ok === false ? "Server offline" : "Server running"}><i className={"dot-s " + (health?.ok === false ? "bad" : "ok")} /><span className="st-text">{health?.ok === false ? "Server offline" : "Server running"}</span></div>
                <div title={health?.ai ? "AI connected" : "No DeepSeek key"}><i className={"dot-s " + (health?.ai ? "ok" : "off")} /><span className="st-text">{health?.ai ? "AI connected" : "No DeepSeek key"}</span></div>
                <div title={health?.n8n ? "LinkedIn posting on" : "Post by hand (n8n off)"}><i className={"dot-s " + (health?.n8n ? "ok" : "off")} /><span className="st-text">{health?.n8n ? "LinkedIn posting on" : "Post by hand (n8n off)"}</span></div>
              </div>
            </div>
          </aside>
          {!collapsed && (
            <div className="resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize the sidebar (arrow keys, double-click to reset)" aria-valuenow={sbWidth} aria-valuemin={SB.min} aria-valuemax={SB.max}
              tabIndex={0} onPointerDown={startResize} onKeyDown={onHandleKey} onDoubleClick={() => setSbWidth(SB.def)} />
          )}
        </div>

        <div className="content">
          {health?.demo && <div className="demo-banner" role="note">You're looking at a demo with sample data. The AI, LinkedIn posting and backups are switched off.</div>}
          <TopBar collapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
          <main className="main" id="main">
            <div className="page" key={location.pathname}>
              <Suspense fallback={<div className="empty">Loading…</div>}>
              <Routes location={location}>
                <Route path="/" element={<Today />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/skills" element={<Skills />} />
                <Route path="/review" element={<Review />} />
                <Route path="/wins" element={<Wins />} />
                <Route path="/backup" element={<Backup />} />
                <Route path="/books" element={<Books />} />
                <Route path="/books/:slug" element={<BookDetail />} />
                <Route path="/study" element={<Study />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/posts" element={<Posts />} />
                <Route path="/posts/:id" element={<PostEditor />} />
                <Route path="/emails" element={<Emails />} />
                <Route path="/emails/:id" element={<EmailEditor />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/pet" element={<Pet />} />
                <Route path="/profile" element={<Profile />} />
                {DevUi ? <Route path="/dev/ui" element={<DevUi />} /> : null}
              </Routes>
              </Suspense>
            </div>
          </main>
        </div>

        <nav className="tabbar" aria-label="Quick menu">
          {ALL.filter((i) => i.tab).map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
              <Icon name={i.icon} size={22} /><span>{i.label.replace("Talk it out", "Talk")}</span>
            </NavLink>
          ))}
          <button className={"tab" + (sheet ? " active" : "")} onClick={() => setSheet(!sheet)} aria-expanded={sheet}>
            <Icon name="more" size={22} /><span>More</span>
          </button>
        </nav>

        {sheet && (
          <div className="sheet-bg" onClick={() => setSheet(false)}>
            <div className="more-sheet card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="All pages">
              <PetWidget compact />
              <div className="more-grid">
                {ALL.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.to === "/"} className={navCls}><Icon name={i.icon} /> <span>{i.label}</span></NavLink>
                ))}
              </div>
              <div className="more-appearance"><span>Light or dark</span><ThemeSwitch /></div>
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

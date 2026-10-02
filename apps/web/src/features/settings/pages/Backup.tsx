import { useEffect, useState } from "react";
import { MyReminders } from "../../reminders/index.ts";
import More from "../../../components/More.tsx";
import { api, errorOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import { type ThemeMode, getTheme, setTheme } from "../../../theme.ts";
import type { Backups, Settings } from "../../../types.ts";
import { type QuoteSettings, readQuoteSettings, writeQuoteSettings } from "../../../components/Quotes.tsx";
import { QUOTE_CATEGORIES } from "../../../data/quotes.ts";

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (d: string) => new Date(d).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Backup() {
  const toast = useToast();
  const [data, setData] = useState<Backups>({ backups: [], folder: "" });
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<Settings | null>(null);
  const [theme, setThemeState] = useState(getTheme());
  const [quotes, setQuotes] = useState(readQuoteSettings());
  const saveQuotes = (patch: Partial<QuoteSettings>) => { const next = { ...quotes, ...patch }; setQuotes(next); writeQuoteSettings(next); };
  const pickTheme = (t: ThemeMode) => { setThemeState(t); setTheme(t); };
  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener("theme-change", sync);
    return () => window.removeEventListener("theme-change", sync);
  }, []);

  useEffect(() => { api.get("/settings").then(setPrefs).catch(() => {}); }, []);
  const savePrefs = async (patch: Partial<Settings>) => {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    try { setPrefs(await api.patch("/settings", patch)); } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };
  const testNotification = async () => {
    try { await api.post("/notify/test"); toast("Sent. Look at the corner of your screen 🔔"); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
  };

  const load = () => api.get("/backups").then(setData).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []);

  const backupNow = async () => {
    setBusy(true);
    try {
      const out = await api.post("/backups");
      setData({ backups: out.backups, folder: out.folder });
      toast("Backup saved 💾 Everything you have right now is safe.");
    } catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };

  const newest = data.backups[0];

  return (
    <>
      <h1>Settings</h1>
      <p className="sub">Your reminders, plus a few things most people never need to change.</p>

      <div className="grid2">
        <div className="card">
          <h2>Appearance</h2>
          <p className="muted">Light, dark, or follow your computer.</p>
          <div className="seg" role="radiogroup" aria-label="Theme">
            {([["auto", "Automatic"], ["light", "Light"], ["dark", "Dark"]] as [ThemeMode, string][]).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? "on" : ""} onClick={() => pickTheme(k)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Gentle lines</h2>
            <label className="row" style={{ gap: "var(--s-1)", cursor: "pointer" }}>
              <input type="checkbox" className="check" checked={quotes.on} onChange={(e) => saveQuotes({ on: e.target.checked })} />
              <b>{quotes.on ? "On" : "Off"}</b>
            </label>
          </div>
          <p className="muted">A short kind line now and then while the app is open. It never steals focus.</p>
          <More label="Customize" className="in-card">
          <div className="row">
            <label className="muted">Every
              <select style={{ margin: "0 var(--s-2)" }} value={quotes.everyMin} onChange={(e) => saveQuotes({ everyMin: Number(e.target.value) })}>
                {[2, 3, 5, 10, 15, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select> minutes
            </label>
            <button onClick={() => window.dispatchEvent(new Event("quote-now"))}>Show one now</button>
          </div>
          <div className="chip-row" style={{ marginTop: "var(--s-2)" }}>
            {QUOTE_CATEGORIES.map((c) => (
              <button key={c.id} className={"trait" + (quotes.cats.includes(c.id) ? " on" : "")} aria-pressed={quotes.cats.includes(c.id)}
                onClick={() => { const cats = quotes.cats.includes(c.id) ? quotes.cats.filter((x) => x !== c.id) : [...quotes.cats, c.id]; if (cats.length) saveQuotes({ cats }); }}>
                {c.label}
              </button>
            ))}
          </div>
          </More>
        </div>
      </div>

      <MyReminders />

      {prefs && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Automatic nudges</h2>
            <label className="row" style={{ gap: "var(--s-1)", cursor: "pointer" }}>
              <input type="checkbox" className="check" checked={prefs.reminders} onChange={(e) => savePrefs({ reminders: e.target.checked })} />
              <b>{prefs.reminders ? "On" : "Off"}</b>
            </label>
          </div>
          <p className="muted">Gentle notifications the app sends by itself: breaks, scheduled posts and your morning plan. Your own reminders above always work.</p>
          <More label="What and when" className="in-card">
          <ul className="muted" style={{ margin: "0 0 var(--s-2)", paddingLeft: "var(--s-4)" }}>
            <li>A gentle nudge to take a break when you've been studying a long time</li>
            <li>A heads-up 10 minutes before a scheduled post goes live</li>
            <li>When a scheduled post went out, or didn't</li>
            <li>A morning note about what's on for today</li>
          </ul>
          <div className="row">
            <label className="muted">Break nudge after
              <input type="number" min="15" max="180" style={{ width: 70, margin: "0 var(--s-2)" }} value={prefs.breakEveryMin}
                onChange={(e) => setPrefs({ ...prefs, breakEveryMin: Number(e.target.value) })}
                onBlur={() => savePrefs({ breakEveryMin: prefs.breakEveryMin })} /> min of studying
            </label>
            <label className="muted">Morning note at
              <input type="time" style={{ width: "auto", marginLeft: "var(--s-1)" }} value={prefs.morningAt} onChange={(e) => savePrefs({ morningAt: e.target.value })} />
            </label>
            <button onClick={testNotification}>Send a test notification</button>
          </div>
          <p className="muted tiny" style={{ marginTop: "var(--s-2)" }}>Don't see the test? Check that Windows "Do not disturb" or "Focus" is off and that notifications are allowed in Windows settings.</p>
          </More>
        </div>
      )}

      <h2 style={{ marginTop: "var(--s-4)" }}>Backup</h2>
      <p className="sub">Everything you save lives in one file on this computer. Backups keep copies of it.</p>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <b>{newest ? `Last backup: ${when(newest.createdAt)}` : "No backup yet"}</b>
            <div className="muted">The app also backs up by itself once a day and keeps the newest 30.</div>
          </div>
          <button className="primary big" disabled={busy} onClick={backupNow}>{busy ? "Saving…" : "Back up now"}</button>
        </div>
      </div>

      <div className="card plain-more">
        <More label={`All my backups (${data.backups.length})`}>
        {data.backups.length === 0 && <div className="empty">Nothing here yet.</div>}
        {data.backups.length > 0 && (
          <table className="ptable">
            <thead><tr><th>Date</th><th className="num">Size</th><th /></tr></thead>
            <tbody>
              {data.backups.map((b) => (
                <tr key={b.name} style={{ cursor: "default" }}>
                  <td>{when(b.createdAt)}</td>
                  <td className="num muted">{kb(b.size)}</td>
                  <td className="nowrap" style={{ textAlign: "right" }}>
                    <a href={`/api/backups/${b.name}/download`} download={b.name}>⬇ Download a copy</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.folder && <p className="muted tiny" style={{ marginTop: "var(--s-3)" }}>Saved in: {data.folder}</p>}
        </More>
      </div>

      <div className="card plain-more">
        <More label="Keeping backups safe, and how to restore">
        <p className="muted">These backups live on the same computer. If the computer breaks, they go with it. Once in a while, use “Download a copy” and put the file on a USB stick or in cloud storage.</p>
        <h3>Not included in a backup</h3>
        <ul className="muted" style={{ margin: "0 0 var(--s-2)", paddingLeft: "var(--s-4)" }}>
          <li>Your secret keys (DeepSeek and others) in the <code>.env</code> files. Keep them in a password manager.</li>
          <li>Your n8n workflow and LinkedIn connection. The workflow is also saved in the project's <code>n8n</code> folder; you would only need to sign in to LinkedIn again.</li>
        </ul>
        <h3>How to restore a backup</h3>
        <ol className="muted" style={{ margin: 0, paddingLeft: "var(--s-4)" }}>
          <li>Close the app (run <code>scripts\stop-all.ps1</code>, or restart the computer and stop it before it starts).</li>
          <li>Copy the backup file over <code>server\prisma\dev.db</code>.</li>
          <li>Start the app again. Or ask me and I'll do it with you.</li>
        </ol>
        </More>
      </div>
    </>
  );
}

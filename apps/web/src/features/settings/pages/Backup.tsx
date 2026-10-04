import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import LanguageSwitch from "../../../components/LanguageSwitch.tsx";
import MenuEditor from "../components/MenuEditor.tsx";
import { Link } from "@tanstack/react-router";
import { signOut, useMe } from "../../account/index.ts";
import { useEffect, useState } from "react";
import { MyReminders } from "../../reminders/index.ts";
import More from "../../../components/More.tsx";
import { useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import { type ThemeMode, getTheme, setTheme } from "../../../theme.ts";
import { useBackupNow, useBackups, useSaveSettings, useSettings } from "../api.ts";
import type { A11y } from "../a11y.ts";
import Connections from "../components/Connections.tsx";
import DevicePush from "../components/DevicePush.tsx";
import YourData from "../components/YourData.tsx";

// the choices for each accessibility setting, in the order they are shown (P3-18)
const A11Y_OPTIONS: { key: Exclude<keyof A11y, "focusMode">; label: string; hint: string; choices: [string, string][] }[] = [
  { key: "motion", label: i18next.t("settings.movement"), hint: i18next.t("settings.alwaysCalmTurnsOff"), choices: [["auto", "Follow my computer"], ["reduce", "Always calm"]] },
  { key: "font", label: i18next.t("settings.font"), hint: i18next.t("settings.easyToReadUses"), choices: [["default", "Usual"], ["readable", "Easy to read"]] },
  { key: "textSize", label: i18next.t("settings.textSize"), hint: i18next.t("settings.makesAllTheText"), choices: [["normal", "Normal"], ["large", "Large"], ["larger", "Larger"]] },
];
import { type QuoteSettings, readQuoteSettings, writeQuoteSettings } from "../../../components/Quotes.tsx";
import { QUOTE_CATEGORIES } from "../../../data/quotes.ts";

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (d: string) => new Date(d).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Backup() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const data = useBackups().data ?? { backups: [], folder: "" };
  const backup = useBackupNow();
  const busy = backup.isPending;
  const prefs = useSettings().data ?? null;
  const saveSettings = useSaveSettings();
  const notifyTest = useApiChange("post", "/notify/test");
  const [breakEvery, setBreakEvery] = useState<number | null>(null); // while typing; saved when you leave the box
  const [theme, setThemeState] = useState(getTheme());
  const [quotes, setQuotes] = useState(readQuoteSettings());
  const saveQuotes = (patch: Partial<QuoteSettings>) => { const next = { ...quotes, ...patch }; setQuotes(next); writeQuoteSettings(next); };
  const pickTheme = (t: ThemeMode) => { setThemeState(t); setTheme(t); };
  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener("theme-change", sync);
    return () => window.removeEventListener("theme-change", sync);
  }, []);

  const savePrefs = (patch: Parameters<typeof saveSettings.mutate>[0]) => saveSettings.mutate(patch);
  const testNotification = () => notifyTest.mutate(undefined, { onSuccess: () => toast(i18next.t("settings.sentLookAtThe")) });
  // cloud mode (P5-04): who is signed in, and signing out
  const me = useMe().data;
  const client = useQueryClient();
  const backupNow = () => backup.mutate(undefined, { onSuccess: () => toast(i18next.t("settings.backupSavedEverythingYou")) });

  // your time zone, from this device, the first time (P5-11: quiet hours and the morning note use your clock)
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (prefs && !prefs.timeZone && tz) saveSettings.mutate({ timeZone: tz });
  }, [prefs, saveSettings]);

  const newest = data.backups[0];

  return (
    <>
      <h1>{i18next.t("settings.settings")}</h1>
      <p className="sub">{i18next.t("settings.yourRemindersPlusA")}</p>

      {me?.mode === "cloud" && me.user && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><b>{i18next.t("misc.signedInAs", { name: me.user.name })}</b><div className="muted">{me.user.email}</div></div>
            <button onClick={() => void signOut(client)}>{i18next.t("settings.signOut")}</button>
          </div>
        </div>
      )}

      <Connections />

      <YourData />

      {me?.user?.role === "admin" && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><b>{i18next.t("settings.youAreAnAdmin")}</b><div className="muted">{i18next.t("settings.servicesPeopleAndFeature")}</div></div>
            <Link className="btn" to="/admin">{i18next.t("settings.openTheAdminArea")}</Link>
          </div>
        </div>
      )}

      <div className="card">
        <h2>{i18next.t("settings.easierToUse")}</h2>
        <p className="muted">{i18next.t("settings.savedWithYourSettings")}</p>
        <div className="form-grid">
          {A11Y_OPTIONS.map((o) => (
            <div key={o.key} className="field">
              <div className="field-label" id={`a11y-${o.key}`}>{o.label}</div>
              <div className="seg" role="radiogroup" aria-labelledby={`a11y-${o.key}`}>
                {o.choices.map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={prefs?.[o.key] === v} className={prefs?.[o.key] === v ? "on" : ""} disabled={!prefs} onClick={() => savePrefs({ [o.key]: v })}>{l}</button>
                ))}
              </div>
              <p className="muted tiny">{o.hint}</p>
            </div>
          ))}
          <label className="row" style={{ gap: "var(--s-2)", cursor: "pointer" }}>
            <input type="checkbox" className="check" checked={!!prefs?.focusMode} disabled={!prefs} onChange={(e) => savePrefs({ focusMode: e.target.checked })} />
            <span><b>{i18next.t("settings.focusMode")}</b><span className="muted tiny" style={{ display: "block" }}>{i18next.t("settings.hidesTheSidebarSo")}</span></span>
          </label>
        </div>
      </div>

      <MenuEditor />

      <div className="grid2">
        <div className="card">
          <h2>{i18next.t("settings.appearance")}</h2>
          <p className="muted">{i18next.t("settings.lightDarkAllWhite")}</p>
          <div className="seg" role="radiogroup" aria-label={i18next.t("settings.theme")}>
            {([["auto", i18next.t("misc.themeAuto")], ["light", i18next.t("misc.themeLight")], ["dark", i18next.t("misc.themeDark")], ["white", i18next.t("misc.themeWhite")], ["black", i18next.t("misc.themeBlack")]] as [ThemeMode, string][]).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? "on" : ""} onClick={() => pickTheme(k)}>{l}</button>
            ))}
          </div>
          <div style={{ marginTop: "var(--s-3)" }}><LanguageSwitch id="lang-settings" /></div>
        </div>

        <div className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>{i18next.t("settings.gentleLines")}</h2>
            <label className="row" style={{ gap: "var(--s-1)", cursor: "pointer" }}>
              <input type="checkbox" className="check" checked={quotes.on} onChange={(e) => saveQuotes({ on: e.target.checked })} />
              <b>{quotes.on ? i18next.t("settings.on") : i18next.t("settings.off")}</b>
            </label>
          </div>
          <p className="muted">{i18next.t("settings.aShortKindLine")}</p>
          <More label={i18next.t("settings.customize")} className="in-card">
          <div className="row">
            <label className="muted">{i18next.t("settings.every")}
              <select style={{ margin: "0 var(--s-2)" }} value={quotes.everyMin} onChange={(e) => saveQuotes({ everyMin: Number(e.target.value) })}>
                {[2, 3, 5, 10, 15, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select> {i18next.t("settings.minutes")}
            </label>
            <button onClick={() => window.dispatchEvent(new Event("quote-now"))}>{i18next.t("settings.showOneNow")}</button>
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
            <h2 style={{ margin: 0 }}>{i18next.t("settings.automaticNudges")}</h2>
            <label className="row" style={{ gap: "var(--s-1)", cursor: "pointer" }}>
              <input type="checkbox" className="check" checked={prefs.reminders} onChange={(e) => savePrefs({ reminders: e.target.checked })} />
              <b>{prefs.reminders ? i18next.t("settings.on") : i18next.t("settings.off")}</b>
            </label>
          </div>
          <p className="muted">{i18next.t("settings.gentleNotificationsTheApp")}</p>
          <More label={i18next.t("settings.whatAndWhen")} className="in-card">
          <ul className="muted" style={{ margin: "0 0 var(--s-2)", paddingLeft: "var(--s-4)" }}>
            <li>{i18next.t("settings.aGentleNudgeTo")}</li>
            <li>{i18next.t("settings.aHeadsUp10")}</li>
            <li>{i18next.t("settings.whenAScheduledPost")}</li>
            <li>{i18next.t("settings.aMorningNoteAbout")}</li>
          </ul>
          <div className="row">
            <label className="muted">{i18next.t("settings.breakNudgeAfter")}
              <input type="number" min="15" max="180" style={{ width: 70, margin: "0 var(--s-2)" }} value={breakEvery ?? prefs.breakEveryMin}
                onChange={(e) => setBreakEvery(Number(e.target.value))}
                onBlur={() => { if (breakEvery !== null) savePrefs({ breakEveryMin: breakEvery }); setBreakEvery(null); }} /> {i18next.t("settings.minOfStudying")}
            </label>
            <label className="muted">{i18next.t("settings.morningNoteAt")}
              <input type="time" style={{ width: "auto", marginLeft: "var(--s-1)" }} value={prefs.morningAt} onChange={(e) => savePrefs({ morningAt: e.target.value })} />
            </label>
            <button onClick={testNotification}>{i18next.t("settings.sendATestNotification")}</button>
          </div>
          {me?.mode !== "cloud" && <p className="muted tiny" style={{ marginTop: "var(--s-2)" }}>{i18next.t("settings.donTSeeThe")}</p>}
          </More>
        </div>
      )}

      {prefs && (
        <div className="card" aria-labelledby="notif-title">
          <h2 id="notif-title" style={{ marginTop: 0 }}>{i18next.t("settings.whereNotificationsGo")}</h2>
          <p className="muted">{i18next.t("settings.everyNotificationIsIn")}</p>
          {me?.mode !== "cloud" && (
            <label className="row" style={{ gap: "var(--s-1)" }}>
              <input type="checkbox" className="check" checked={prefs.desktop} onChange={(e) => savePrefs({ desktop: e.target.checked })} />
              {i18next.t("settings.popUpsOnThis")}
            </label>
          )}
          <DevicePush />
          <div className="row" style={{ marginTop: "var(--s-2)" }}>
            <label className="row" style={{ gap: "var(--s-1)" }}>
              <input type="checkbox" className="check" checked={prefs.emailDigest} onChange={(e) => savePrefs({ emailDigest: e.target.checked })} />
              {i18next.t("settings.aDailyEmailWith")}
            </label>
            {prefs.emailDigest && (
              <label className="muted">{i18next.t("settings.at")}
                <input type="time" aria-label={i18next.t("settings.dailyEmailTime")} style={{ width: "auto", marginLeft: "var(--s-1)" }} value={prefs.digestAt} onChange={(e) => savePrefs({ digestAt: e.target.value })} />
              </label>
            )}
          </div>
          {prefs.emailDigest && <p className="muted tiny">Sent to {me?.user?.email || "the email in your Profile"}, only on days with something unread.</p>}
          <div className="row" style={{ marginTop: "var(--s-2)" }}>
            <label className="muted">{i18next.t("settings.quietFrom")}
              <input type="time" aria-label={i18next.t("settings.quietHoursStart")} style={{ width: "auto", margin: "0 var(--s-1)" }} value={prefs.quietFrom} onChange={(e) => savePrefs({ quietFrom: e.target.value })} />
            </label>
            <label className="muted">{i18next.t("settings.to")}
              <input type="time" aria-label={i18next.t("settings.quietHoursEnd")} style={{ width: "auto", marginLeft: "var(--s-1)" }} value={prefs.quietTo} onChange={(e) => savePrefs({ quietTo: e.target.value })} />
            </label>
            {(prefs.quietFrom || prefs.quietTo) && <button className="ghost" onClick={() => savePrefs({ quietFrom: "", quietTo: "" })}>{i18next.t("settings.noQuietHours")}</button>}
          </div>
          <p className="muted tiny">{i18next.t("misc.quietHoursNote", { zone: prefs.timeZone || i18next.t("misc.thisComputers") })}</p>
        </div>
      )}

      <h2 style={{ marginTop: "var(--s-4)" }}>{i18next.t("settings.backup")}</h2>
      <p className="sub">{i18next.t("settings.everythingYouSaveLives")}</p>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <b>{newest ? `Last backup: ${when(newest.createdAt)}` : i18next.t("settings.noBackupYet")}</b>
            <div className="muted">{i18next.t("settings.theAppAlsoBacks")}</div>
          </div>
          <button className="primary big" disabled={busy} onClick={backupNow}>{busy ? i18next.t("settings.saving") : i18next.t("settings.backUpNow")}</button>
        </div>
      </div>


      <div className="card plain-more">
        <More label={`All my backups (${data.backups.length})`}>
        {data.backups.length === 0 && <div className="empty">{i18next.t("settings.nothingHereYet")}</div>}
        {data.backups.length > 0 && (
          <table className="ptable">
            <thead><tr><th>{i18next.t("settings.date")}</th><th className="num">{i18next.t("settings.size")}</th><th /></tr></thead>
            <tbody>
              {data.backups.map((b) => (
                <tr key={b.name} style={{ cursor: "default" }}>
                  <td>{when(b.createdAt)}</td>
                  <td className="num muted">{kb(b.size)}</td>
                  <td className="nowrap" style={{ textAlign: "right" }}>
                    <a href={`/api/backups/${b.name}/download`} download={b.name}>{i18next.t("settings.downloadACopy")}</a>
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
        <More label={i18next.t("settings.keepingBackupsSafeAnd")}>
        <p className="muted">{i18next.t("settings.theseBackupsLiveOn")}</p>
        <h3>{i18next.t("settings.notIncludedInA")}</h3>
        <ul className="muted" style={{ margin: "0 0 var(--s-2)", paddingLeft: "var(--s-4)" }}>
          <li>{i18next.t("settings.yourSecretKeysDeepseek")} <code>{i18next.t("settings.env")}</code> {i18next.t("settings.filesKeepThemIn")}</li>
          <li>{i18next.t("settings.yourN8nWorkflowAnd")} <code>n8n</code> {i18next.t("settings.folderYouWouldOnly")}</li>
        </ul>
        <h3>{i18next.t("settings.howToRestoreA")}</h3>
        <ol className="muted" style={{ margin: 0, paddingLeft: "var(--s-4)" }}>
          <li>{i18next.t("settings.closeTheAppRun")} <code>{i18next.t("settings.scriptsStopAllPs1")}</code>{i18next.t("settings.orRestartTheComputer")}</li>
          <li>{i18next.t("settings.inTheProjectFolder")} <code>{i18next.t("settings.pnpmDbRestoreBackups")}</code> {i18next.t("settings.followedByTheBackup")}</li>
          <li>{i18next.t("settings.startTheAppAgain")}</li>
        </ol>
        </More>
      </div>
    </>
  );
}

import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Settings as SharedSettings } from "@hyperfocus/shared";
import { config } from "./config.ts";
import { enqueue } from "./outbox.ts";
import { compact } from "./types.ts";

// Windows desktop notifications sent by the server, so they work even when the browser is closed.
const SETTINGS_FILE = config.settingsFile || fileURLToPath(new URL("../settings.json", import.meta.url));
export type Settings = SharedSettings & { sent: Record<string, number> };
// the accessibility settings (P3-18) start as the app always looked: motion follows the computer, usual fonts and size
const DEFAULTS: Settings = { reminders: true, breakEveryMin: 50, morningAt: "09:00", motion: "auto", font: "default", textSize: "normal", focusMode: false, sent: {} };

export function getSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}
// The values are checked before they get here (UpdateSettingsInput in @hyperfocus/shared); fields left undefined are kept.
export function saveSettings(patch: { [K in keyof Settings]?: Settings[K] | undefined }): Settings {
  const next = { ...getSettings(), ...compact(patch) };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
  return next;
}

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Resolves with { ok, error }. The PowerShell script is passed encoded so no quoting can break it.
export function notify(title: string, body: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (config.notifyDryRun) { console.log(`[notify dry-run] ${title} | ${body}`); return resolve({ ok: true }); }
    if (process.platform !== "win32") return resolve({ ok: false, error: "Desktop notifications are only set up for Windows." });
    const script = `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text>${esc(title).replace(/'/g, "''")}</text><text>${esc(body).replace(/'/g, "''")}</text></binding></visual></toast>')
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($toast)
`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const p = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded], { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ ok: false, error: e.message }));
    // success is judged by the exit code; PowerShell's stderr can contain harmless progress text
    p.on("close", (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: err.replace(/<[^>]+>/g, " ").trim().slice(0, 300) || `exit code ${code}` }));
  });
}

// Sends a reminder only when reminders are on, and only once per key.
// A nudge, sent once per key (P4-06: through the outbox, so it is saved with the change that caused it and never sent twice,
// even with several copies of the API). Nothing is queued while reminders are switched off in Settings.
export async function remind(db: Parameters<typeof enqueue>[0], key: string, title: string, body: string): Promise<void> {
  if (!getSettings().reminders) return;
  await enqueue(db, key, title, body);
}

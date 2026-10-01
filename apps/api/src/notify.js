import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Windows desktop notifications sent by the server, so they work even when the browser is closed.
const SETTINGS_FILE = process.env.SETTINGS_FILE || fileURLToPath(new URL("../settings.json", import.meta.url));
const DEFAULTS = { reminders: true, breakEveryMin: 50, morningAt: "09:00", sent: {} };

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}
export function saveSettings(patch) {
  const cur = getSettings();
  const next = { ...cur };
  if (typeof patch.reminders === "boolean") next.reminders = patch.reminders;
  if (Number.isFinite(patch.breakEveryMin)) next.breakEveryMin = Math.min(180, Math.max(15, Math.round(patch.breakEveryMin)));
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.morningAt || "")) next.morningAt = patch.morningAt;
  if (patch.sent) next.sent = patch.sent;
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
  return next;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Resolves with { ok, error }. The PowerShell script is passed encoded so no quoting can break it.
export function notify(title, body) {
  return new Promise((resolve) => {
    if (process.env.NOTIFY_DRY_RUN) { console.log(`[notify dry-run] ${title} | ${body}`); return resolve({ ok: true }); }
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
export async function remind(key, title, body) {
  const s = getSettings();
  if (!s.reminders || s.sent[key]) return;
  const now = Date.now();
  const sent = Object.fromEntries(Object.entries(s.sent).filter(([, t]) => now - t < 3 * 86400000)); // forget old keys
  sent[key] = now;
  saveSettings({ sent });
  const r = await notify(title, body);
  if (!r.ok) console.error("Notification failed:", r.error);
}

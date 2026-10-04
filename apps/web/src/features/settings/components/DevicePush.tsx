import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../../../api.ts";
import { keyOf } from "../../../api/query.ts";

// Notifications on this device (P5-11, web push): asks the browser for permission, subscribes it with the app's key, and
// tells the server where to send. Works with the app closed (the service worker in /sw.js shows them).

type State = "checking" | "unsupported" | "off-server" | "blocked" | "off" | "on" | "busy";

const urlKey = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export default function DevicePush() {
  useTranslation(); // (re-renders this page when the language changes)
  const client = useQueryClient();
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported()) return setState("unsupported");
    void (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setState(Notification.permission === "denied" ? "blocked" : sub ? "on" : "off");
    })();
  }, []);

  const turnOn = async () => {
    setError("");
    setState("busy");
    try {
      const { publicKey } = await api.get("/push/key").catch(() => ({ publicKey: "" }));
      if (!publicKey) return setState("off-server");
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKey(publicKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
      await client.invalidateQueries({ queryKey: keyOf("/settings") });
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("settings.thatDidnTWork"));
      setState("off");
    }
  };
  const turnOff = async () => {
    setState("busy");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => undefined);
      await sub.unsubscribe();
    }
    await client.invalidateQueries({ queryKey: keyOf("/settings") });
    setState("off");
  };

  return (
    <div className="row" style={{ justifyContent: "space-between", marginTop: "var(--s-2)" }}>
      <div>
        <b>{i18next.t("settings.onThisDevice")}</b>
        <div className="muted tiny" role="status">
          {state === "checking" && "Checking…"}
          {state === "unsupported" && "This browser can't show notifications from Hyperfocus. On iPhone, add Hyperfocus to the Home Screen first."}
          {state === "off-server" && "Notifications on devices aren't set up for this app yet."}
          {state === "blocked" && "Notifications are blocked for this site. Allow them in the browser's site settings (the lock next to the address)."}
          {state === "off" && "Off: reminders only show in the bell while Hyperfocus is open."}
          {state === "on" && "On: notifications pop up here even when Hyperfocus is closed."}
          {state === "busy" && "One moment…"}
        </div>
        {error && <p role="alert" className="error tiny">{error}</p>}
      </div>
      {state === "off" && <button onClick={() => void turnOn()}>{i18next.t("settings.turnOnForThis")}</button>}
      {state === "on" && <button onClick={() => void turnOff()}>{i18next.t("settings.turnOffForThis")}</button>}
    </div>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api.ts";
import { useApi } from "../api/hooks.ts";
import { keyOf } from "../api/query.ts";
import Icon from "./Icon.tsx";

// The bell (P5-11): your notifications in the app, the newest first, with how many are unread. Every notification is
// here, even the ones that didn't pop up (quiet hours, pop-ups off). Checked every 30 seconds.

const when = (iso: string, lang: string) => new Date(iso).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" });

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const inbox = useApi("/notifications", { refetchInterval: 30_000, meta: { silent: true } }).data;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = inbox?.unread ?? 0;

  // closes on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const readAll = async () => {
    await api.post("/notifications/read", {});
    await client.invalidateQueries({ queryKey: keyOf("/notifications") });
  };

  return (
    <div className="bell" ref={box}>
      <button className="ghost icon-btn bell-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}
        aria-label={unread ? t("bell.labelUnread", { count: unread }) : t("bell.label")} title={t("bell.label")}>
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel card" role="dialog" aria-label={t("bell.label")}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>{t("bell.label")}</b>
            {unread > 0 && <button className="ghost" onClick={() => void readAll()}>{t("bell.readAll")}</button>}
          </div>
          {!inbox?.items.length ? (
            <p className="muted">{t("bell.empty")}</p>
          ) : (
            <ul className="bell-list">
              {inbox.items.map((n) => (
                <li key={n.id} className={n.read ? "" : "unread"}>
                  <b>{n.title}</b>
                  {n.body && <div>{n.body}</div>}
                  <small className="muted">{when(n.createdAt, i18n.language)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

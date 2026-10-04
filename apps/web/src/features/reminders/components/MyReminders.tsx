import { REMINDER_REPEATS, type ReminderRepeat } from "@hyperfocus/shared/constants";
import i18next from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { oneOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import More from "../../../components/More.tsx";
import { useAddReminder, useDeleteReminder, useMoveReminder, useReminders } from "../api.ts";

// (labels are word keys: the words are in the language files, P3-28)
const REPEATS: [string, "once" | "daily" | "weekdays" | "weekly"][] = [
  ["none", "once"],
  ["daily", "daily"],
  ["weekdays", "weekdays"],
  ["weekly", "weekly"],
];
const pad = (n: number) => String(n).padStart(2, "0");
const toInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const inMin = (m: number) => new Date(Date.now() + m * 60000);
const nextAt = (h: number, plusDay = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + plusDay);
  d.setHours(h, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
};
const QUICK: ["in10" | "in30" | "in60" | "evening" | "tomorrowMorning", () => Date][] = [
  ["in10", () => inMin(10)],
  ["in30", () => inMin(30)],
  ["in60", () => inMin(60)],
  ["evening", () => nextAt(19)],
  [
    "tomorrowMorning",
    () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  ],
];

function whenLabel(iso: string | Date) {
  const d = new Date(iso),
    n = new Date(),
    t = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((t(d) - t(n)) / 864e5);
  const lang = i18next.language;
  const time = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return i18next.t("reminders.todayAt", { time });
  if (days === 1) return i18next.t("reminders.tomorrowAt", { time });
  if (days === -1) return i18next.t("reminders.yesterdayAt", { time });
  return `${d.toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

// Reminders she writes herself. `compact` is the small version on the Today page.
export default function MyReminders({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const { t } = useTranslation();
  const list = useReminders().data ?? null;
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(() => toInput(inMin(60)));
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const add = useAddReminder();
  const deleteReminder = useDeleteReminder();
  const move = useMoveReminder();
  const busy = add.isPending;

  const create = (when: Date) => {
    if (!title.trim() || busy) return;
    add.mutate(
      { title, at: when.toISOString(), repeat },
      {
        onSuccess: () => {
          toast(t("reminders.willRemind", { when: whenLabel(when) }));
          setTitle("");
          setRepeat("none");
        },
      },
    );
  };
  const remove = (r: { id: number }) => deleteReminder.mutate(r.id);
  const again = (r: { id: number }) =>
    move.mutate({ id: r.id, at: inMin(10).toISOString() }, { onSuccess: () => toast(t("reminders.snoozed")) });

  const upcoming = (list || []).filter((r) => !r.done);
  const past = (list || []).filter((r) => r.done);
  const shown = compact ? upcoming.slice(0, 3) : upcoming;

  return (
    <div className="card my-rem">
      <h2>{compact ? t("reminders.title") : t("reminders.mine")}</h2>
      {!compact && <p className="muted">{t("reminders.intro")}</p>}

      <form
        className="rem-add"
        onSubmit={(e) => {
          e.preventDefault();
          const t = new Date(at);
          create(t > new Date() ? t : inMin(60));
        }}
      >
        <input
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("reminders.placeholder")}
          aria-label={t("reminders.about")}
        />
        <div className="chip-row" role="group" aria-label={t("reminders.when")}>
          {QUICK.map(([label, fn]) => (
            <button
              type="button"
              key={label}
              className="trait"
              disabled={!title.trim() || busy}
              onClick={() => create(fn())}
            >
              {t(`reminders.${label}`)}
            </button>
          ))}
        </div>
        <More label={t("reminders.exact")} className="inline">
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label={t("reminders.dateTime")} />
          <select
            value={repeat}
            onChange={(e) => setRepeat(oneOf(REMINDER_REPEATS, e.target.value, "none"))}
            aria-label={t("reminders.repeat")}
          >
            {REPEATS.map(([k, l]) => (
              <option key={k} value={k}>
                {t(`reminders.${l}`)}
              </option>
            ))}
          </select>
          <button className="primary" disabled={!title.trim() || !at || busy}>
            {t("reminders.add")}
          </button>
        </More>
      </form>

      {list !== null && shown.length === 0 && <p className="muted rem-empty">{t("reminders.none")}</p>}
      {shown.length > 0 && (
        <ul className="rem-list">
          {shown.map((r) => (
            <li key={r.id}>
              <div className="grow">
                <b>{r.title}</b>
                <div className="muted tiny">
                  {whenLabel(r.at)}
                  {r.repeat !== "none" ? ` · ${t(`reminders.${REPEATS.find(([k]) => k === r.repeat)?.[1] ?? "once"}`)}` : ""}
                </div>
              </div>
              <button className="ghost danger" onClick={() => remove(r)} aria-label={t("reminders.deleteNamed", { title: r.title })}>
                {t("reminders.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {compact && upcoming.length > 3 && <p className="muted tiny">{t("reminders.more", { count: upcoming.length - 3 })}</p>}

      {!compact && past.length > 0 && (
        <More label={t("reminders.recent", { count: past.length })} className="in-card">
          <ul className="rem-list">
            {past.map((r) => (
              <li key={r.id}>
                <div className="grow">
                  <b>{r.title}</b>
                  <div className="muted tiny">{t("reminders.sent", { when: whenLabel(r.lastFiredAt || r.at) })}</div>
                </div>
                <button className="ghost" onClick={() => again(r)}>
                  {t("reminders.again")}
                </button>
                <button className="ghost danger" onClick={() => remove(r)} aria-label={t("reminders.deleteNamed", { title: r.title })}>
                  {t("reminders.delete")}
                </button>
              </li>
            ))}
          </ul>
        </More>
      )}
    </div>
  );
}

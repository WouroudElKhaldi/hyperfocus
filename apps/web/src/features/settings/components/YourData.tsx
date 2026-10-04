import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { api } from "../../../api.ts";
import { keyOf } from "../../../api/query.ts";
import { useMe } from "../../account/index.ts";
import { useSaveSettings, useSettings } from "../api.ts";

// Your data and privacy (P5-12): export, how long AI chats are kept, the privacy policy, and deleting your account.

const KEEP: [number, string][] = [[0, "Keep them"], [30, "30 days"], [90, "90 days"], [365, "1 year"]];

export default function YourData() {
  useTranslation(); // (re-renders this page when the language changes)
  const me = useMe().data;
  const prefs = useSettings().data;
  const save = useSaveSettings();
  const client = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    try {
      await api.post("/account/delete", { confirm: String(f.get("confirm") ?? ""), ...(f.get("password") ? { password: String(f.get("password")) } : {}) });
      client.removeQueries({ predicate: (q) => JSON.stringify(q.queryKey) !== JSON.stringify(keyOf("/me")) });
      await client.refetchQueries({ queryKey: keyOf("/me") });
    } catch (err) {
      setError(err instanceof Error ? err.message : i18next.t("settings.thatDidnTWork"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" aria-labelledby="data-title">
      <h2 id="data-title" style={{ marginTop: 0 }}>{i18next.t("settings.yourDataAndPrivacy")}</h2>
      <p className="muted">
        {i18next.t("settings.everythingYouPutIn")} <Link to="/privacy">{i18next.t("settings.readWhatWeKeep")}</Link>.
      </p>
      <div className="row" style={{ marginTop: "var(--s-2)" }}>
        <a className="btn" href="/api/export" download>{i18next.t("settings.exportMyData")}</a>
        <span className="muted tiny">{i18next.t("settings.everythingYouSavedAs")}</span>
      </div>
      {prefs && (
        <div className="field" style={{ marginTop: "var(--s-3)" }}>
          <div className="field-label" id="keep-chats">{i18next.t("settings.deleteAiChatsOlder")}</div>
          <div className="seg" role="radiogroup" aria-labelledby="keep-chats">
            {KEEP.map(([days, label]) => (
              <button key={days} role="radio" aria-checked={prefs.chatKeepDays === days} className={prefs.chatKeepDays === days ? "on" : ""} onClick={() => save.mutate({ chatKeepDays: days })}>{label}</button>
            ))}
          </div>
          <p className="muted tiny">{i18next.t("settings.yourConversationsOnTalk")}</p>
        </div>
      )}
      {me?.mode === "cloud" && (
        <div style={{ marginTop: "var(--s-3)" }}>
          {!deleting ? (
            <button className="ghost danger" onClick={() => setDeleting(true)}>{i18next.t("settings.deleteMyAccount")}</button>
          ) : (
            <form className="card warn-card" onSubmit={remove} aria-label={i18next.t("settings.deleteMyAccount")}>
              <p><b>{i18next.t("settings.thisDeletesYourAccount")}</b> {i18next.t("settings.yourTasksNotesPosts")}</p>
              <div className="field">
                <label htmlFor="del-confirm">{i18next.t("settings.typeDeleteToConfirm")}</label>
                <input id="del-confirm" name="confirm" autoComplete="off" required />
              </div>
              <div className="field">
                <label htmlFor="del-password">{i18next.t("settings.yourPassword")}</label>
                <input id="del-password" name="password" type="password" autoComplete="current-password" />
                <p className="muted tiny">{i18next.t("settings.madeYourAccountWith")}</p>
              </div>
              {error && <p role="alert" className="error">{error}</p>}
              <div className="row">
                <button className="danger" type="submit" disabled={busy}>{busy ? i18next.t("settings.deleting") : i18next.t("settings.deleteEverything")}</button>
                <button type="button" onClick={() => { setDeleting(false); setError(""); }}>{i18next.t("settings.keepMyAccount")}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

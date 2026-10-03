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
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" aria-labelledby="data-title">
      <h2 id="data-title" style={{ marginTop: 0 }}>Your data and privacy</h2>
      <p className="muted">
        Everything you put in Hyperfocus is yours. <Link to="/privacy">Read what we keep and why</Link>.
      </p>
      <div className="row" style={{ marginTop: "var(--s-2)" }}>
        <a className="btn" href="/api/export" download>⬇ Export my data</a>
        <span className="muted tiny">Everything you saved, as one zip you can open: each list as readable JSON, plus your email files. Yours to keep or take elsewhere.</span>
      </div>
      {prefs && (
        <div className="field" style={{ marginTop: "var(--s-3)" }}>
          <div className="field-label" id="keep-chats">Delete AI chats older than</div>
          <div className="seg" role="radiogroup" aria-labelledby="keep-chats">
            {KEEP.map(([days, label]) => (
              <button key={days} role="radio" aria-checked={prefs.chatKeepDays === days} className={prefs.chatKeepDays === days ? "on" : ""} onClick={() => save.mutate({ chatKeepDays: days })}>{label}</button>
            ))}
          </div>
          <p className="muted tiny">Your conversations on Talk and your questions about books. Checked a few times a day.</p>
        </div>
      )}
      {me?.mode === "cloud" && (
        <div style={{ marginTop: "var(--s-3)" }}>
          {!deleting ? (
            <button className="ghost danger" onClick={() => setDeleting(true)}>Delete my account</button>
          ) : (
            <form className="card warn-card" onSubmit={remove} aria-label="Delete my account">
              <p><b>This deletes your account and everything in it, for good.</b> Your tasks, notes, posts, emails, files, chats, pet and settings. It can't be undone. Export your data first if you want to keep a copy.</p>
              <div className="field">
                <label htmlFor="del-confirm">Type DELETE to confirm</label>
                <input id="del-confirm" name="confirm" autoComplete="off" required />
              </div>
              <div className="field">
                <label htmlFor="del-password">Your password</label>
                <input id="del-password" name="password" type="password" autoComplete="current-password" />
                <p className="muted tiny">Made your account with Google? Leave this empty; you need to have signed in within the last 10 minutes.</p>
              </div>
              {error && <p role="alert" className="error">{error}</p>}
              <div className="row">
                <button className="danger" type="submit" disabled={busy}>{busy ? "Deleting…" : "Delete everything"}</button>
                <button type="button" onClick={() => { setDeleting(false); setError(""); }}>Keep my account</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

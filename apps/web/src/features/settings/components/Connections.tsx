import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { keyOf } from "../../../api/query.ts";
import { Link } from "@tanstack/react-router";

// which part of the step-by-step guide (/help/connections) explains each one
const GUIDE = { deepseek: "ai", gmail: "gmail", "linkedin-app": "linkedin", n8n: "linkedin-n8n" } as const;

// Your own credentials (P5-07): the AI (DeepSeek key), LinkedIn posting (your n8n webhook) and email (your Gmail with an
// App Password). Sealed on the server and never shown again: after saving you only see which account it is.

type Field = { name: string; label: string; type?: string; placeholder: string; hint?: string };
const KINDS: { id: "deepseek" | "linkedin-app" | "n8n" | "gmail"; title: string; what: string; fields: Field[] }[] = [
  {
    id: "deepseek", title: i18next.t("settings.aiDeepseek"), what: i18next.t("settings.rewritesCoachingChatAnd"),
    fields: [{ name: "apiKey", label: i18next.t("settings.deepseekApiKey"), type: "password", placeholder: "sk-…", hint: i18next.t("settings.fromPlatformDeepseekCom") }],
  },
  {
    // P5-09: your own free LinkedIn app, then "Connect LinkedIn"
    id: "linkedin-app", title: i18next.t("settings.linkedinPosting"), what: i18next.t("settings.publishingYourPostsTo"),
    fields: [
      { name: "clientId", label: i18next.t("settings.linkedinAppClientId"), placeholder: "86abc123xyz", hint: i18next.t("settings.yourAppAtLinkedin") },
      { name: "clientSecret", label: i18next.t("settings.linkedinAppClientSecret"), type: "password", placeholder: i18next.t("settings.primaryClientSecret"), hint: i18next.t("settings.sameTabPrimaryClient") },
    ],
  },
  {
    id: "n8n", title: i18next.t("settings.linkedinThroughN8nOptional"), what: i18next.t("settings.insteadOfTheLinkedin"),
    fields: [{ name: "webhookUrl", label: "n8n webhook address", type: "url", placeholder: "https://your-n8n.example/webhook/…", hint: i18next.t("settings.theProductionUrlOf") }],
  },
  {
    id: "gmail", title: i18next.t("settings.emailGmail"), what: i18next.t("settings.sendingEmailsFromYour"),
    fields: [
      { name: "user", label: i18next.t("settings.gmailAddress"), type: "email", placeholder: "you@gmail.com" },
      { name: "appKey", label: i18next.t("settings.gmailAppPassword"), type: "password", placeholder: "abcd efgh ijkl mnop", hint: "16 letters, from myaccount.google.com/apppasswords (needs 2-Step Verification)." },
    ],
  },
];

export default function Connections() {
  useTranslation(); // (re-renders this page when the language changes)
  const client = useQueryClient();
  const saved = useApi("/integrations").data ?? [];
  const usage = useApi("/ai/usage").data; // P5-10: today's AI requests on the app's key
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: keyOf("/integrations") }), client.invalidateQueries({ queryKey: keyOf("/me") }), client.invalidateQueries({ queryKey: keyOf("/ai/usage") })]);
  const save = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, string> }) => api.put(`/integrations/${id}`, values),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/integrations/${id}`), onSuccess: refresh });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  // back from Google (P5-08): ?connected=gmail or ?connect-error=…, said once, then taken out of the address
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected") === "linkedin") setNotice("✅ LinkedIn connected. Your posts now go straight to your LinkedIn.");
    const failed = q.get("connect-error");
    if (failed) setError({ id: "linkedin-app", message: failed });
    if (q.has("connected") || failed) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const directLinkedIn = saved.find((s) => s.provider === "linkedin"); // P5-09
  /** Off to LinkedIn to allow it; back in Settings afterwards. */
  const connectLinkedIn = (id: string) =>
    api.get("/integrations/linkedin/start").then(
      ({ url }) => window.location.assign(url),
      (err) => setError({ id, message: err instanceof Error ? err.message : i18next.t("settings.thatDidnTWork") }),
    );

  const submit = (id: string) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
    setError(null);
    save.mutate({ id, values }, {
      onSuccess: () => setEditing(null),
      onError: (err) => setError({ id, message: err instanceof Error ? err.message : i18next.t("settings.thatDidnTWork") }),
    });
  };

  return (
    <div className="card">
      <h2>{i18next.t("settings.yourConnections")}</h2>
      <p className="muted">{i18next.t("settings.yourOwnKeysFor")} <Link to="/help/connections">{i18next.t("settings.stepByStepGuides")}</Link>.</p>
      {notice && <p role="status">{notice}</p>}
      {KINDS.map((k) => {
        const have = saved.find((s) => s.provider === k.id);
        const open = editing === k.id || !have;
        return (
          <section key={k.id} className="connection" aria-label={k.title}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <b>{k.title}</b>
                <Link className="tiny" to="/help/connections" hash={GUIDE[k.id]}>{i18next.t("settings.howDoIGet")}</Link>
                <div className="muted">{have ? <>✅ {k.id === "linkedin-app" ? i18next.t("settings.appSaved") : i18next.t("settings.connected")}: {have.account}</> : k.what}</div>
              </div>
              {have && editing !== k.id && (
                <div className="row">
                  <button onClick={() => setEditing(k.id)}>{i18next.t("settings.change")}</button>
                  <button onClick={() => remove.mutate(k.id)}>{i18next.t("settings.disconnect")}</button>
                </div>
              )}
            </div>
            {k.id === "deepseek" && usage && usage.shared && usage.limit > 0 && !usage.ownKey && (
              <p className="muted tiny" data-testid="ai-usage">Today: {usage.used} of {usage.limit} AI requests on the app's key. Add your own key above for no limit.</p>
            )}
            {k.id === "linkedin-app" && (
              <>
                <p className="muted tiny">{i18next.t("settings.inYourLinkedinApp")} <code>{`${window.location.origin}/api/integrations/linkedin/callback`}</code></p>
                {have && (directLinkedIn ? (
                  <div className="row">
                    <span>✅ Posting as {directLinkedIn.account}</span>
                    <button onClick={() => remove.mutate("linkedin")}>{i18next.t("settings.disconnectLinkedin")}</button>
                  </div>
                ) : (
                  <p><button type="button" className="primary" onClick={() => void connectLinkedIn("linkedin-app")}>{i18next.t("settings.connectLinkedin")}</button> <span className="muted tiny">{i18next.t("settings.linkedinAsksYouTo")}</span></p>
                ))}
                {!open && error?.id === k.id && <p role="alert" className="error">{error.message}</p>}
              </>
            )}
            {open && (
              <form className="form-grid" onSubmit={submit(k.id)}>
                {k.fields.map((f) => (
                  <div key={f.name} className="field">
                    <label htmlFor={`${k.id}-${f.name}`}>{f.label}</label>
                    <input id={`${k.id}-${f.name}`} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} autoComplete="off" required />
                    {f.hint && <p className="muted tiny">{f.hint}</p>}
                  </div>
                ))}
                {error?.id === k.id && <p role="alert" className="error">{error.message}</p>}
                <div className="row">
                  <button className="primary" type="submit" disabled={save.isPending}>Save {k.title}</button>
                  {have && <button type="button" onClick={() => setEditing(null)}>{i18next.t("settings.cancel")}</button>}
                </div>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}

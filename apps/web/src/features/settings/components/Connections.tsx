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
    id: "deepseek", title: "AI (DeepSeek)", what: "Rewrites, coaching, chat and everything else the AI does for you.",
    fields: [{ name: "apiKey", label: "DeepSeek API key", type: "password", placeholder: "sk-…", hint: "From platform.deepseek.com → API keys." }],
  },
  {
    // P5-09: your own free LinkedIn app, then "Connect LinkedIn"
    id: "linkedin-app", title: "LinkedIn posting", what: "Publishing your posts to your LinkedIn, now or scheduled, through your own (free) LinkedIn app.",
    fields: [
      { name: "clientId", label: "LinkedIn app Client ID", placeholder: "86abc123xyz", hint: "Your app at linkedin.com/developers/apps → Auth tab." },
      { name: "clientSecret", label: "LinkedIn app Client Secret", type: "password", placeholder: "Primary Client Secret", hint: "Same tab: Primary Client Secret (click the eye to show it)." },
    ],
  },
  {
    id: "n8n", title: "LinkedIn through n8n (optional)", what: "Instead of the LinkedIn app: your own n8n, at a public https address.",
    fields: [{ name: "webhookUrl", label: "n8n webhook address", type: "url", placeholder: "https://your-n8n.example/webhook/…", hint: "The production URL of the Webhook node in your LinkedIn workflow." }],
  },
  {
    id: "gmail", title: "Email (Gmail)", what: "Sending emails from your own Gmail address.",
    fields: [
      { name: "user", label: "Gmail address", type: "email", placeholder: "you@gmail.com" },
      { name: "appKey", label: "Gmail App Password", type: "password", placeholder: "abcd efgh ijkl mnop", hint: "16 letters, from myaccount.google.com/apppasswords (needs 2-Step Verification)." },
    ],
  },
];

export default function Connections() {
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
      (err) => setError({ id, message: err instanceof Error ? err.message : "That didn't work." }),
    );

  const submit = (id: string) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
    setError(null);
    save.mutate({ id, values }, {
      onSuccess: () => setEditing(null),
      onError: (err) => setError({ id, message: err instanceof Error ? err.message : "That didn't work." }),
    });
  };

  return (
    <div className="card">
      <h2>Your connections</h2>
      <p className="muted">Your own keys for the AI, LinkedIn and email. They are locked (encrypted) when saved and never shown again. Not sure how? <Link to="/help/connections">Step-by-step guides</Link>.</p>
      {notice && <p role="status">{notice}</p>}
      {KINDS.map((k) => {
        const have = saved.find((s) => s.provider === k.id);
        const open = editing === k.id || !have;
        return (
          <section key={k.id} className="connection" aria-label={k.title}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <b>{k.title}</b>
                <Link className="tiny" to="/help/connections" hash={GUIDE[k.id]}>How do I get this?</Link>
                <div className="muted">{have ? <>✅ {k.id === "linkedin-app" ? "App saved" : "Connected"}: {have.account}</> : k.what}</div>
              </div>
              {have && editing !== k.id && (
                <div className="row">
                  <button onClick={() => setEditing(k.id)}>Change</button>
                  <button onClick={() => remove.mutate(k.id)}>Disconnect</button>
                </div>
              )}
            </div>
            {k.id === "deepseek" && usage && usage.shared && usage.limit > 0 && !usage.ownKey && (
              <p className="muted tiny" data-testid="ai-usage">Today: {usage.used} of {usage.limit} AI requests on the app's key. Add your own key above for no limit.</p>
            )}
            {k.id === "linkedin-app" && (
              <>
                <p className="muted tiny">In your LinkedIn app, add this as an authorised redirect URL: <code>{`${window.location.origin}/api/integrations/linkedin/callback`}</code></p>
                {have && (directLinkedIn ? (
                  <div className="row">
                    <span>✅ Posting as {directLinkedIn.account}</span>
                    <button onClick={() => remove.mutate("linkedin")}>Disconnect LinkedIn</button>
                  </div>
                ) : (
                  <p><button type="button" className="primary" onClick={() => void connectLinkedIn("linkedin-app")}>Connect LinkedIn</button> <span className="muted tiny">LinkedIn asks you to allow posting; you come back here.</span></p>
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
                  {have && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}
                </div>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}

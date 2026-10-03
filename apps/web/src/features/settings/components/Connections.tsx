import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { keyOf } from "../../../api/query.ts";

// Your own credentials (P5-07): the AI (DeepSeek key), LinkedIn posting (your n8n webhook) and email (your Gmail with an
// App Password). Sealed on the server and never shown again: after saving you only see which account it is.

type Field = { name: string; label: string; type?: string; placeholder: string; hint?: string };
const KINDS: { id: "deepseek" | "n8n" | "gmail"; title: string; what: string; fields: Field[] }[] = [
  {
    id: "deepseek", title: "AI (DeepSeek)", what: "Rewrites, coaching, chat and everything else the AI does for you.",
    fields: [{ name: "apiKey", label: "DeepSeek API key", type: "password", placeholder: "sk-…", hint: "From platform.deepseek.com → API keys." }],
  },
  {
    id: "n8n", title: "LinkedIn posting (n8n)", what: "Publishing your posts to LinkedIn, now or scheduled.",
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
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: keyOf("/integrations") }), client.invalidateQueries({ queryKey: keyOf("/me") })]);
  const save = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, string> }) => api.put(`/integrations/${id}`, values),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/integrations/${id}`), onSuccess: refresh });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

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
      <p className="muted">Your own keys for the AI, LinkedIn and email. They are locked (encrypted) when saved and never shown again.</p>
      {KINDS.map((k) => {
        const have = saved.find((s) => s.provider === k.id);
        const open = editing === k.id || !have;
        return (
          <section key={k.id} className="connection" aria-label={k.title}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <b>{k.title}</b>
                <div className="muted">{have ? <>✅ Connected: {have.account}</> : k.what}</div>
              </div>
              {have && editing !== k.id && (
                <div className="row">
                  <button onClick={() => setEditing(k.id)}>Change</button>
                  <button onClick={() => remove.mutate(k.id)}>Disconnect</button>
                </div>
              )}
            </div>
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

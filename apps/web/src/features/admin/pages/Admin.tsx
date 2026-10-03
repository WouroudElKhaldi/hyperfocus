import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { keyOf } from "../../../api/query.ts";
import { useMe } from "../../account/index.ts";
import JobSources from "../components/JobSources.tsx";

// The admin area (P5-06): which outside services are connected, the people with accounts (make someone an admin), and
// feature flags switched on or off for everyone, and the job sources (P6-18). Only admins see the link; the API says 403 to anyone else anyway.

const yes = (on: boolean) => (on ? "✅ connected" : "— not set up");

export default function Admin() {
  const me = useMe().data;
  const admin = me?.user?.role === "admin";
  const providers = useApi("/admin/providers", { enabled: admin }).data;
  const people = useApi("/admin/users", { enabled: admin }).data ?? [];
  const flags = useApi("/admin/flags", { enabled: admin }).data ?? [];
  const client = useQueryClient();
  const refresh = (...urls: string[]) => Promise.all(urls.map((u) => client.invalidateQueries({ queryKey: keyOf(u) })));
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "user" | "admin" }) => api.patch(`/admin/users/${id}`, { role }),
    onSettled: () => refresh("/admin/users"),
  });
  const setFlag = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => api.put(`/admin/flags/${key}`, { enabled }),
    // the box changes at once (the list is read again afterwards)
    onMutate: ({ key, enabled }) =>
      client.setQueryData(keyOf("/admin/flags"), (old: typeof flags | undefined) => old?.map((f) => (f.key === key ? { ...f, enabled } : f))),
    onSettled: () => refresh("/admin/flags", "/me"),
  });
  const [newFlag, setNewFlag] = useState("");

  if (me && !admin) {
    return (
      <>
        <h1>Admin</h1>
        <p className="sub">Only admins can open this page.</p>
        <Link className="btn primary" to="/">Back to Today</Link>
      </>
    );
  }

  return (
    <>
      <h1>Admin</h1>
      <p className="sub">The whole app: connected services, people, and features switched on for everyone.</p>

      <div className="card">
        <h2>Services</h2>
        {providers && (
          <ul className="plain">
            <li>Mode: <b>{providers.mode}</b></li>
            <li>AI: {yes(providers.ai)}</li>
            <li>LinkedIn posting: {yes(providers.linkedin)}</li>
            <li>Email: {yes(providers.email)}</li>
            <li>Sign in with Google: {yes(providers.google)}</li>
            <li>Uploaded files are kept in: <b>{providers.fileStorage}</b></li>
            <li>Accounts: <b>{providers.people}</b></li>
          </ul>
        )}
      </div>

      <div className="card">
        <h2>People</h2>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.role}</td>
                <td>
                  {p.id !== me?.user?.id && (
                    <button disabled={setRole.isPending} onClick={() => setRole.mutate({ id: p.id, role: p.role === "admin" ? "user" : "admin" })}>
                      {p.role === "admin" ? "Make a user" : "Make an admin"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Feature flags</h2>
        <p className="muted">A feature that is switched on here is on for everyone.</p>
        {flags.map((f) => (
          <label key={f.key} className="row">
            <input type="checkbox" checked={f.enabled} onChange={(e) => setFlag.mutate({ key: f.key, enabled: e.target.checked })} />
            <span>{f.key}</span>
            {f.note && <span className="muted">{f.note}</span>}
          </label>
        ))}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const key = newFlag.trim().toLowerCase();
            if (key) setFlag.mutate({ key, enabled: true }, { onSuccess: () => setNewFlag("") });
          }}
        >
          <label htmlFor="new-flag" className="sr-only">New flag</label>
          <input id="new-flag" placeholder="new-feature-name" value={newFlag} pattern="[a-z0-9][a-z0-9\-]*" onChange={(e) => setNewFlag(e.target.value)} />
          <button type="submit">Add and switch on</button>
        </form>
      </div>

      <JobSources />
    </>
  );
}

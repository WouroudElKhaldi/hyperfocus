import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { keyOf } from "../../../api/query.ts";
import { useMe } from "../../account/index.ts";
import JobList from "../components/JobList.tsx";
import JobSources from "../components/JobSources.tsx";

// The admin area (P5-06): which outside services are connected, the people with accounts (make someone an admin), and
// feature flags switched on or off for everyone, the job sources (P6-18) and the job list (P6-09). Only admins see the link; the API says 403 to anyone else anyway.

const yes = (on: boolean) => (on ? i18next.t("admin.connected") : i18next.t("admin.notSetUp"));

export default function Admin() {
  useTranslation(); // (re-renders this page when the language changes)
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
        <h1>{i18next.t("admin.admin")}</h1>
        <p className="sub">{i18next.t("admin.onlyAdminsCanOpen")}</p>
        <Link className="btn primary" to="/">{i18next.t("admin.backToToday")}</Link>
      </>
    );
  }

  return (
    <>
      <h1>{i18next.t("admin.admin")}</h1>
      <p className="sub">{i18next.t("admin.theWholeAppConnected")}</p>

      <div className="card">
        <h2>{i18next.t("admin.services")}</h2>
        {providers && (
          <ul className="plain">
            <li>{i18next.t("admin.mode")} <b>{providers.mode}</b></li>
            <li>{i18next.t("admin.ai")} {yes(providers.ai)}</li>
            <li>{i18next.t("admin.linkedinPosting")} {yes(providers.linkedin)}</li>
            <li>{i18next.t("admin.emailLine")} {yes(providers.email)}</li>
            <li>{i18next.t("admin.googleSignIn")} {yes(providers.google)}</li>
            <li>{i18next.t("admin.uploadedFilesAreKept")} <b>{providers.fileStorage}</b></li>
            <li>{i18next.t("admin.accounts")} <b>{providers.people}</b></li>
          </ul>
        )}
      </div>

      <div className="card">
        <h2>{i18next.t("admin.people")}</h2>
        <table className="table">
          <thead><tr><th>{i18next.t("admin.name")}</th><th>{i18next.t("admin.email")}</th><th>{i18next.t("admin.role")}</th><th /></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.role}</td>
                <td>
                  {p.id !== me?.user?.id && (
                    <button disabled={setRole.isPending} onClick={() => setRole.mutate({ id: p.id, role: p.role === "admin" ? "user" : "admin" })}>
                      {p.role === "admin" ? i18next.t("admin.makeAUser") : i18next.t("admin.makeAnAdmin")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>{i18next.t("admin.featureFlags")}</h2>
        <p className="muted">{i18next.t("admin.aFeatureThatIs")}</p>
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
          <label htmlFor="new-flag" className="sr-only">{i18next.t("admin.newFlag")}</label>
          <input id="new-flag" placeholder={i18next.t("admin.newFeatureName")} value={newFlag} pattern="[a-z0-9][a-z0-9\-]*" onChange={(e) => setNewFlag(e.target.value)} />
          <button type="submit">{i18next.t("admin.addAndSwitchOn")}</button>
        </form>
      </div>

      <JobSources />
      <JobList />
    </>
  );
}

import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";

// The job list (P6-09): find an occupation, add the local names it goes by, fix its description, add one the datasets
// don't have, and merge a duplicate into another (it is then shown as that one everywhere).

export default function JobList() {
  useTranslation(); // (re-renders this page when the language changes)
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const found = useApi(`/admin/taxonomy/occupations?q=${encodeURIComponent(q.trim())}` as "/admin/taxonomy/occupations", { enabled: q.trim().length >= 2 }).data;
  const open = useApi(`/admin/taxonomy/occupations/${openId ?? 0}` as "/admin/taxonomy/occupations/{id}", { enabled: openId !== null }).data;
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ predicate: (x) => JSON.stringify(x.queryKey).includes("/admin/taxonomy") });
  const run = useMutation({ mutationFn: (f: () => Promise<unknown>) => f(), onSuccess: refresh });
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [mergeQ, setMergeQ] = useState("");
  const targets = useApi(`/admin/taxonomy/occupations?q=${encodeURIComponent(mergeQ.trim())}` as "/admin/taxonomy/occupations", { enabled: mergeQ.trim().length >= 2 }).data;

  return (
    <div className="card">
      <h2>{i18next.t("admin.jobList")}</h2>
      <p className="muted">{i18next.t("admin.theOccupationsPeoplePick")}</p>
      <div className="row">
        <label htmlFor="jl-q" className="sr-only">{i18next.t("admin.findAnOccupation")}</label>
        <input id="jl-q" placeholder={i18next.t("admin.findAnOccupationName")} value={q} onChange={(e) => setQ(e.target.value)} />
        <button disabled={q.trim().length < 2 || run.isPending} onClick={() => run.mutate(async () => setOpenId(((await api.post("/admin/taxonomy/occupations", { title: q.trim() })) as { id: number }).id))}>{i18next.t("admin.addAsNew", { name: q.trim() || "…" })}</button>
      </div>
      {found && (
        <ul className="plain" aria-label={i18next.t("admin.occupationsFound")}>
          {found.items.map((o) => (
            <li key={o.id}>
              <button className="ghost" aria-pressed={openId === o.id} onClick={() => setOpenId(o.id)}>{o.title}</button>
              <small className="muted"> {o.code} · {i18next.t("admin.namesCount", { count: o.titles })}{o.sameAs ? i18next.t("admin.shownAsName", { name: o.sameAs.title }) : ""}</small>
            </li>
          ))}
          {found.total > found.items.length && <li className="muted">…and {found.total - found.items.length} more: type more letters.</li>}
        </ul>
      )}
      {open && openId !== null && (
        <section aria-label={`Occupation ${open.title}`} className="radar-advanced">
          <h3>{open.title} <small className="muted">{open.code}</small></h3>
          {open.sameAs && (
            <p>{i18next.t("admin.shownAs")} <b>{open.sameAs.title}</b>. <button className="ghost" onClick={() => run.mutate(() => api.patch(`/admin/taxonomy/occupations/${openId}`, { sameAsId: null }))}>{i18next.t("admin.unmerge")}</button></p>
          )}
          <h4>{i18next.t("admin.namesItGoesBy")}</h4>
          <ul className="row radar-picked">
            {open.titles.map((t) => (
              <li key={t.id} className="chip">
                {t.title} <small>({t.lang}{t.kind === "local" ? ", local" : ""})</small>
                {t.kind === "local" && <button className="ghost" aria-label={`Remove ${t.title}`} onClick={() => run.mutate(() => api.del(`/admin/taxonomy/titles/${t.id}`))}>×</button>}
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run.mutate(() => api.post(`/admin/taxonomy/occupations/${openId}/titles`, { title: name.trim(), lang }), { onSuccess: () => setName("") }); }}>
            <label htmlFor="jl-name" className="sr-only">{i18next.t("admin.localName")}</label>
            <input id="jl-name" placeholder={i18next.t("admin.aLocalNameFor")} value={name} onChange={(e) => setName(e.target.value)} />
            <label htmlFor="jl-lang" className="sr-only">{i18next.t("admin.language")}</label>
            <select id="jl-lang" value={lang} onChange={(e) => setLang(e.target.value)}>{["en", "ar", "fr"].map((l) => <option key={l} value={l}>{l}</option>)}</select>
            <button type="submit">{i18next.t("admin.addTheName")}</button>
          </form>
          <h4>{i18next.t("admin.mergeIntoAnother")}</h4>
          <div className="row">
            <label htmlFor="jl-merge" className="sr-only">{i18next.t("admin.mergeInto")}</label>
            <input id="jl-merge" placeholder={i18next.t("admin.findTheOneIt")} value={mergeQ} onChange={(e) => setMergeQ(e.target.value)} />
          </div>
          <ul className="plain">
            {(targets?.items ?? []).filter((o) => o.id !== openId).slice(0, 5).map((o) => (
              <li key={o.id}><button className="ghost" onClick={() => run.mutate(() => api.patch(`/admin/taxonomy/occupations/${openId}`, { sameAsId: o.id }), { onSuccess: () => setMergeQ("") })}>{i18next.t("admin.sameAs", { name: o.title })} <small className="muted">{o.code}</small></button></li>
            ))}
          </ul>
          {run.error && <p className="error" role="alert">{(run.error as Error).message}</p>}
        </section>
      )}
    </div>
  );
}

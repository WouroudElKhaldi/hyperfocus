import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";

// The job list (P6-09): find an occupation, add the local names it goes by, fix its description, add one the datasets
// don't have, and merge a duplicate into another (it is then shown as that one everywhere).

export default function JobList() {
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
      <h2>Job list</h2>
      <p className="muted">The occupations people pick in Job Radar. Local names and local occupations stay through every update of the datasets.</p>
      <div className="row">
        <label htmlFor="jl-q" className="sr-only">Find an occupation</label>
        <input id="jl-q" placeholder="Find an occupation (name, any title, or code)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button disabled={q.trim().length < 2 || run.isPending} onClick={() => run.mutate(async () => setOpenId(((await api.post("/admin/taxonomy/occupations", { title: q.trim() })) as { id: number }).id))}>Add “{q.trim() || "…"}” as a new occupation</button>
      </div>
      {found && (
        <ul className="plain" aria-label="Occupations found">
          {found.items.map((o) => (
            <li key={o.id}>
              <button className="ghost" aria-pressed={openId === o.id} onClick={() => setOpenId(o.id)}>{o.title}</button>
              <small className="muted"> {o.code} · {o.titles} names{o.sameAs ? ` · shown as ${o.sameAs.title}` : ""}</small>
            </li>
          ))}
          {found.total > found.items.length && <li className="muted">…and {found.total - found.items.length} more: type more letters.</li>}
        </ul>
      )}
      {open && openId !== null && (
        <section aria-label={`Occupation ${open.title}`} className="radar-advanced">
          <h3>{open.title} <small className="muted">{open.code}</small></h3>
          {open.sameAs && (
            <p>Shown as <b>{open.sameAs.title}</b>. <button className="ghost" onClick={() => run.mutate(() => api.patch(`/admin/taxonomy/occupations/${openId}`, { sameAsId: null }))}>Unmerge</button></p>
          )}
          <h4>Names it goes by</h4>
          <ul className="row radar-picked">
            {open.titles.map((t) => (
              <li key={t.id} className="chip">
                {t.title} <small>({t.lang}{t.kind === "local" ? ", local" : ""})</small>
                {t.kind === "local" && <button className="ghost" aria-label={`Remove ${t.title}`} onClick={() => run.mutate(() => api.del(`/admin/taxonomy/titles/${t.id}`))}>×</button>}
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run.mutate(() => api.post(`/admin/taxonomy/occupations/${openId}/titles`, { title: name.trim(), lang }), { onSuccess: () => setName("") }); }}>
            <label htmlFor="jl-name" className="sr-only">Local name</label>
            <input id="jl-name" placeholder="A local name for it" value={name} onChange={(e) => setName(e.target.value)} />
            <label htmlFor="jl-lang" className="sr-only">Language</label>
            <select id="jl-lang" value={lang} onChange={(e) => setLang(e.target.value)}>{["en", "ar", "fr"].map((l) => <option key={l} value={l}>{l}</option>)}</select>
            <button type="submit">Add the name</button>
          </form>
          <h4>Merge into another</h4>
          <div className="row">
            <label htmlFor="jl-merge" className="sr-only">Merge into</label>
            <input id="jl-merge" placeholder="Find the one it is the same as" value={mergeQ} onChange={(e) => setMergeQ(e.target.value)} />
          </div>
          <ul className="plain">
            {(targets?.items ?? []).filter((o) => o.id !== openId).slice(0, 5).map((o) => (
              <li key={o.id}><button className="ghost" onClick={() => run.mutate(() => api.patch(`/admin/taxonomy/occupations/${openId}`, { sameAsId: o.id }), { onSuccess: () => setMergeQ("") })}>Same as {o.title} <small className="muted">{o.code}</small></button></li>
            ))}
          </ul>
          {run.error && <p className="error" role="alert">{(run.error as Error).message}</p>}
        </section>
      )}
    </div>
  );
}

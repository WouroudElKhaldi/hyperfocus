import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import TaxonomyPicker from "../../../components/TaxonomyPicker.tsx";
import type { ResponseOf } from "../../../api/typed.ts";

// Skills for my job: your job title (or the job you want), picked from the standard list or typed, and the skills and
// tools it needs, from the shared job list. Add the ones you want to your map, or all of them. Works without the AI.

type ForJob = ResponseOf<"get", "/skills/for-job">;
type SetJob = ResponseOf<"put", "/skills/job">;

export default function JobSkills() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const client = useQueryClient();
  const data = useApi("/skills/for-job").data;
  const [changing, setChanging] = useState(false);
  const [typed, setTyped] = useState("");
  const [closest, setClosest] = useState<SetJob["closest"]>([]);
  const refresh = () => client.invalidateQueries({ predicate: (q) => /\/skills|\/profile/.test(JSON.stringify(q.queryKey)) });
  const setJob = useMutation({
    mutationFn: (b: { code?: string; title?: string }) => api.put("/skills/job", b) as Promise<SetJob>,
    onSuccess: (r) => {
      setClosest(r.job ? [] : r.closest);
      if (r.job) setChanging(false);
      if (!r.job && !r.closest.length) toast(i18next.t("skills.weDonTKnow"));
      refresh();
    },
  });
  const addSkills = useMutation({
    mutationFn: (codes: string[]) => api.post("/skills/from-job", { codes }) as Promise<{ added: string[] }>,
    onSuccess: (r) => { toast(r.added.length ? `Added to your map: ${r.added.join(", ")}` : i18next.t("skills.theyReAlreadyOn")); refresh(); },
  });

  const job = (data as ForJob | undefined)?.job ?? null;
  const skills = (data as ForJob | undefined)?.skills ?? [];
  const missing = skills.filter((s) => !s.have);

  return (
    <section className="card" aria-labelledby="job-skills">
      <h2 id="job-skills">{job ? `Skills for ${job.title}` : i18next.t("skills.skillsForYourJob")}</h2>
      {(!job || changing) && (
        <>
          <p className="muted">{i18next.t("skills.yourJobTitleOr")}</p>
          <TaxonomyPicker kind="occupation" label={i18next.t("skills.yourJob")} placeholder={i18next.t("skills.typeAJobNurse")} onPick={(it) => setJob.mutate({ code: it.code })} />
          <form className="row" style={{ marginTop: "var(--s-2)" }} onSubmit={(e) => { e.preventDefault(); if (typed.trim()) setJob.mutate({ title: typed.trim() }); }}>
            <label htmlFor="job-typed" className="sr-only">{i18next.t("skills.jobTitleNotIn")}</label>
            <input id="job-typed" className="grow" placeholder={i18next.t("skills.notInTheList")} value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button type="submit" disabled={setJob.isPending || !typed.trim()}>{setJob.isPending ? i18next.t("skills.looking") : i18next.t("skills.useThisTitle")}</button>
          </form>
          {closest.length > 0 && (
            <div aria-label={i18next.t("skills.closestJobs")}>
              <p className="muted tiny">{i18next.t("skills.didYouMeanOne")}</p>
              <div className="row" style={{ gap: 6 }}>
                {closest.flatMap((j) => (j ? [j] : [])).map((j) => <button key={j.code} className="chip" onClick={() => setJob.mutate({ code: j.code })}>{j.title}</button>)}
              </div>
            </div>
          )}
        </>
      )}
      {job && !changing && (
        <>
          <ul className="row radar-picked" aria-label={`Skills for ${job.title}`}>
            {skills.map((s) => (
              <li key={s.code}>
                {s.have ? (
                  <span className="chip on">✓ {s.name}</span>
                ) : (
                  <button className="chip" disabled={addSkills.isPending} title={i18next.t("skills.addToMyMap")} onClick={() => addSkills.mutate([s.code])}>➕ {s.name}{s.hot ? " 🔥" : ""}</button>
                )}
              </li>
            ))}
          </ul>
          {skills.length === 0 && <p className="muted">{i18next.t("skills.theJobListHas")}</p>}
          <div className="row">
            {missing.length > 1 && <button className="primary" disabled={addSkills.isPending} onClick={() => addSkills.mutate(missing.map((s) => s.code))}>Add all {missing.length}</button>}
            <button className="ghost" onClick={() => setChanging(true)}>{i18next.t("skills.changeMyJob")}</button>
          </div>
          <p className="muted tiny">{i18next.t("skills.askedForInMany")}</p>
        </>
      )}
    </section>
  );
}

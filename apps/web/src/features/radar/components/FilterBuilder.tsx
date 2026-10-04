import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import TaxonomyPicker, { type TaxonomyItem } from "../../../components/TaxonomyPicker.tsx";
import { type Spec, type SpecInput, previewFilter } from "../api.ts";

// The filter builder (P6-28). Simple mode is three questions (what jobs, where, what kind of contract); advanced mode
// has everything a filter can ask. A live "≈ N jobs a week" estimate (from the last 7 days) updates as it changes.

// (labels in the chosen language, P3-28)
const CONTRACTS = (): [string, string][] => [["internship", i18next.t("radar.cInternship")], ["student_job", i18next.t("radar.cStudentJob")], ["apprenticeship", i18next.t("radar.cApprenticeship")], ["full_time", i18next.t("radar.cFullTime")], ["part_time", i18next.t("radar.cPartTime")], ["contract", i18next.t("radar.cContract")], ["freelance", i18next.t("radar.cFreelance")]];
const LEVELS = (): [string, string][] => [["student", i18next.t("radar.lStudent")], ["intern", i18next.t("radar.lIntern")], ["entry", i18next.t("radar.lEntry")], ["junior", i18next.t("radar.lJunior")], ["mid", i18next.t("radar.lMid")], ["senior", i18next.t("radar.lSenior")], ["lead", i18next.t("radar.lLead")]];
const MODES = (): [string, string][] => [["remote", i18next.t("radar.mRemote")], ["hybrid", i18next.t("radar.mHybrid")], ["onsite", i18next.t("radar.mOnsite")]];

type Props = { initial?: { name: string; spec: Spec }; onSave: (name: string, spec: SpecInput) => void; onCancel?: () => void; busy?: boolean };

function Chips({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="field">
      <div className="field-label" id={`chips-${label}`}>{label}</div>
      <div className="row" role="group" aria-labelledby={`chips-${label}`} style={{ gap: 6 }}>
        {options.map(([v, l]) => (
          <button key={v} type="button" className={`chip ${value.includes(v) ? "on" : ""}`} aria-pressed={value.includes(v)} onClick={() => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])}>{l}</button>
        ))}
      </div>
    </div>
  );
}
function Picked({ items, onRemove, label }: { items: TaxonomyItem[]; onRemove: (code: string) => void; label: string }) {
  if (!items.length) return null;
  return (
    <ul className="row radar-picked" aria-label={label}>
      {items.map((i) => (
        <li key={i.code} className="chip">{i.label} <button type="button" className="ghost tiny" aria-label={`Remove ${i.label}`} onClick={() => onRemove(i.code)}>✕</button></li>
      ))}
    </ul>
  );
}
const words = (s: string) => s.split(",").map((w) => w.trim()).filter(Boolean);

export default function FilterBuilder({ initial, onSave, onCancel, busy }: Props) {
  useTranslation(); // (re-renders this page when the language changes)
  const s0 = initial?.spec;
  const [name, setName] = useState(initial?.name ?? "");
  const [advanced, setAdvanced] = useState(false);
  const [occupations, setOccupations] = useState<TaxonomyItem[]>(s0?.occupations ?? []);
  const [locations, setLocations] = useState<TaxonomyItem[]>(s0?.locations ?? []);
  const [contracts, setContracts] = useState<string[]>(s0?.employmentTypes ?? []);
  const [levels, setLevels] = useState<string[]>(s0?.seniority ?? []);
  const [modes, setModes] = useState<string[]>(s0?.workModes ?? []);
  const [must, setMust] = useState<TaxonomyItem[]>(s0?.skills.must ?? []);
  const [nice, setNice] = useState<TaxonomyItem[]>(s0?.skills.nice ?? []);
  const [include, setInclude] = useState((s0?.keywords.include ?? []).join(", "));
  const [exclude, setExclude] = useState((s0?.keywords.exclude ?? []).join(", "));
  const [salary, setSalary] = useState(s0?.salaryMin?.amount ? String(s0.salaryMin.amount) : "");
  const [currency, setCurrency] = useState(s0?.salaryMin?.currency ?? "USD");
  const [days, setDays] = useState(s0?.postedWithinDays ? String(s0.postedWithinDays) : "30");
  const [visa, setVisa] = useState(s0?.visaSponsorship === true);
  const [digest, setDigest] = useState<"off" | "daily" | "weekly" | "realtime">((s0?.digest as "daily") ?? "daily");
  const [estimate, setEstimate] = useState<{ perWeek: number; examples: string[] } | null>(null);

  const spec: SpecInput = {
    ...(s0 ?? {}),
    occupations: occupations.map(({ code, label }) => ({ code, label })),
    locations: locations.map(({ code, label }) => ({ code, label, radiusKm: null })),
    employmentTypes: contracts as never,
    seniority: levels as never,
    workModes: modes as never,
    skills: { must: must.map(({ code, label }) => ({ code, label })), nice: nice.map(({ code, label }) => ({ code, label })) },
    keywords: { include: words(include), exclude: words(exclude), scope: ["title", "description"] },
    salaryMin: salary ? { amount: Number(salary), currency } : null,
    postedWithinDays: days ? Number(days) : null,
    visaSponsorship: visa ? true : null,
    digest,
  };
  const key = JSON.stringify(spec);
  useEffect(() => {
    const t = setTimeout(() => { previewFilter(JSON.parse(key)).then(setEstimate, () => setEstimate(null)); }, 400);
    return () => clearTimeout(t);
  }, [key]);

  const add = (set: (f: (v: TaxonomyItem[]) => TaxonomyItem[]) => void) => (it: TaxonomyItem) => set((v) => (v.some((x) => x.code === it.code) ? v : [...v, it]));
  const drop = (set: (f: (v: TaxonomyItem[]) => TaxonomyItem[]) => void) => (code: string) => set((v) => v.filter((x) => x.code !== code));

  return (
    <form className="card radar-builder" aria-label={i18next.t("radar.jobRadarFilter")} onSubmit={(e) => { e.preventDefault(); onSave(name.trim() || occupations[0]?.label || "My jobs", spec); }}>
      <div className="field">
        <label htmlFor="rf-name">{i18next.t("radar.name")}</label>
        <input id="rf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={i18next.t("radar.remoteDesignInternships")} />
      </div>

      <div className="field">
        <div className="field-label">{i18next.t("radar.n1WhatJobs")}</div>
        <TaxonomyPicker kind="occupation" label={i18next.t("radar.addAJob")} placeholder={i18next.t("radar.typeAJobDesigner")} onPick={add(setOccupations)} />
        <Picked items={occupations} onRemove={drop(setOccupations)} label={i18next.t("radar.jobs")} />
      </div>
      <div className="field">
        <div className="field-label">{i18next.t("radar.n2Where")}</div>
        <div className="row">
          <TaxonomyPicker kind="city" label={i18next.t("radar.addACity")} placeholder={i18next.t("radar.aCity")} onPick={add(setLocations)} />
          <TaxonomyPicker kind="country" label={i18next.t("radar.addACountry")} placeholder={i18next.t("radar.orACountry")} onPick={add(setLocations)} />
        </div>
        <Picked items={locations} onRemove={drop(setLocations)} label={i18next.t("radar.places")} />
        <Chips label={i18next.t("radar.workMode")} options={MODES()} value={modes} onChange={setModes} />
      </div>
      <Chips label={i18next.t("radar.n3WhatKindOf")} options={CONTRACTS()} value={contracts} onChange={setContracts} />

      <button type="button" className="ghost" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>{advanced ? i18next.t("radar.fewerOptions") : i18next.t("radar.moreOptions")}</button>
      {advanced && (
        <div className="radar-advanced">
          <Chips label={i18next.t("radar.level")} options={LEVELS()} value={levels} onChange={setLevels} />
          <div className="field">
            <div className="field-label">{i18next.t("radar.skillsTheJobMust")}</div>
            <TaxonomyPicker kind="skill" label={i18next.t("radar.addAMustHave")} placeholder={i18next.t("radar.aSkillOrTool")} onPick={add(setMust)} />
            <Picked items={must} onRemove={drop(setMust)} label={i18next.t("radar.mustHaveSkills")} />
          </div>
          <div className="field">
            <div className="field-label">{i18next.t("radar.skillsThatMakeA")}</div>
            <TaxonomyPicker kind="skill" label={i18next.t("radar.addANiceTo")} placeholder={i18next.t("radar.aSkillOrTool")} onPick={add(setNice)} />
            <Picked items={nice} onRemove={drop(setNice)} label={i18next.t("radar.niceToHaveSkills")} />
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="rf-in">{i18next.t("radar.wordsToLookFor")}</label><input id="rf-in" value={include} onChange={(e) => setInclude(e.target.value)} placeholder={i18next.t("radar.figmaResearch")} /></div>
            <div className="field"><label htmlFor="rf-out">{i18next.t("radar.wordsToAvoid")}</label><input id="rf-out" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder={i18next.t("radar.salesCommission")} /></div>
            <div className="field"><label htmlFor="rf-salary">{i18next.t("radar.minimumSalaryAYear")}</label>
              <div className="row"><input id="rf-salary" type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} style={{ width: 120 }} />
                <select aria-label={i18next.t("radar.currency")} value={currency} onChange={(e) => setCurrency(e.target.value)}>{["USD", "EUR", "GBP", "LBP", "AED", "CAD"].map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="rf-days">{i18next.t("radar.postedInTheLast")}</label>
              <select id="rf-days" value={days} onChange={(e) => setDays(e.target.value)}>{[["7", "week"], ["14", "2 weeks"], ["30", "month"], ["", "any time"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="rf-digest">{i18next.t("radar.tellMeAboutNew")}</label>
              <select id="rf-digest" value={digest} onChange={(e) => setDigest(e.target.value as typeof digest)}>{[["daily", i18next.t("radar.dDaily")], ["weekly", i18next.t("radar.dWeekly")], ["realtime", i18next.t("radar.dRealtime")], ["off", i18next.t("radar.dOff")]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
          </div>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={visa} onChange={(e) => setVisa(e.target.checked)} /> {i18next.t("radar.onlyJobsThatDon")}</label>
        </div>
      )}

      <p className="radar-estimate" role="status">
        {estimate === null ? i18next.t("radar.counting") : estimate.perWeek === 0 ? i18next.t("radar.n0JobsAWeek") : `≈ ${estimate.perWeek} job${estimate.perWeek === 1 ? "" : "s"} a week`}
        {estimate && estimate.examples.length > 0 && <small className="muted"> · like {estimate.examples.join("; ")}</small>}
      </p>
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>{i18next.t("radar.saveFilter")}</button>
        {onCancel && <button type="button" onClick={onCancel}>{i18next.t("radar.cancel")}</button>}
      </div>
    </form>
  );
}

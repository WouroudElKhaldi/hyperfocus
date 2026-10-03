import { useEffect, useState } from "react";
import TaxonomyPicker, { type TaxonomyItem } from "../../../components/TaxonomyPicker.tsx";
import { type Spec, type SpecInput, previewFilter } from "../api.ts";

// The filter builder (P6-28). Simple mode is three questions (what jobs, where, what kind of contract); advanced mode
// has everything a filter can ask. A live "≈ N jobs a week" estimate (from the last 7 days) updates as it changes.

const CONTRACTS: [string, string][] = [["internship", "Internship"], ["student_job", "Student job"], ["apprenticeship", "Apprenticeship"], ["full_time", "Full time"], ["part_time", "Part time"], ["contract", "Contract"], ["freelance", "Freelance"]];
const LEVELS: [string, string][] = [["student", "Student"], ["intern", "Intern"], ["entry", "Entry"], ["junior", "Junior"], ["mid", "Mid"], ["senior", "Senior"], ["lead", "Lead"]];
const MODES: [string, string][] = [["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On site"]];

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
    <form className="card radar-builder" aria-label="Job Radar filter" onSubmit={(e) => { e.preventDefault(); onSave(name.trim() || occupations[0]?.label || "My jobs", spec); }}>
      <div className="field">
        <label htmlFor="rf-name">Name</label>
        <input id="rf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Remote design internships" />
      </div>

      <div className="field">
        <div className="field-label">1. What jobs?</div>
        <TaxonomyPicker kind="occupation" label="Add a job" placeholder="Type a job: designer, nurse, data…" onPick={add(setOccupations)} />
        <Picked items={occupations} onRemove={drop(setOccupations)} label="Jobs" />
      </div>
      <div className="field">
        <div className="field-label">2. Where?</div>
        <div className="row">
          <TaxonomyPicker kind="city" label="Add a city" placeholder="A city…" onPick={add(setLocations)} />
          <TaxonomyPicker kind="country" label="Add a country" placeholder="…or a country" onPick={add(setLocations)} />
        </div>
        <Picked items={locations} onRemove={drop(setLocations)} label="Places" />
        <Chips label="Work mode" options={MODES} value={modes} onChange={setModes} />
      </div>
      <Chips label="3. What kind of contract?" options={CONTRACTS} value={contracts} onChange={setContracts} />

      <button type="button" className="ghost" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>{advanced ? "Fewer options" : "More options"}</button>
      {advanced && (
        <div className="radar-advanced">
          <Chips label="Level" options={LEVELS} value={levels} onChange={setLevels} />
          <div className="field">
            <div className="field-label">Skills the job must ask for</div>
            <TaxonomyPicker kind="skill" label="Add a must-have skill" placeholder="A skill or tool…" onPick={add(setMust)} />
            <Picked items={must} onRemove={drop(setMust)} label="Must-have skills" />
          </div>
          <div className="field">
            <div className="field-label">Skills that make a job a better fit</div>
            <TaxonomyPicker kind="skill" label="Add a nice-to-have skill" placeholder="A skill or tool…" onPick={add(setNice)} />
            <Picked items={nice} onRemove={drop(setNice)} label="Nice-to-have skills" />
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="rf-in">Words to look for</label><input id="rf-in" value={include} onChange={(e) => setInclude(e.target.value)} placeholder="figma, research" /></div>
            <div className="field"><label htmlFor="rf-out">Words to avoid</label><input id="rf-out" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="sales, commission" /></div>
            <div className="field"><label htmlFor="rf-salary">Minimum salary a year</label>
              <div className="row"><input id="rf-salary" type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} style={{ width: 120 }} />
                <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>{["USD", "EUR", "GBP", "LBP", "AED", "CAD"].map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="rf-days">Posted in the last</label>
              <select id="rf-days" value={days} onChange={(e) => setDays(e.target.value)}>{[["7", "week"], ["14", "2 weeks"], ["30", "month"], ["", "any time"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="rf-digest">Tell me about new matches</label>
              <select id="rf-digest" value={digest} onChange={(e) => setDigest(e.target.value as typeof digest)}>{[["daily", "once a day (top 5)"], ["weekly", "once a week (top 5)"], ["realtime", "as they come"], ["off", "don't tell me"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
          </div>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={visa} onChange={(e) => setVisa(e.target.checked)} /> Only jobs that don't rule out visa sponsorship</label>
        </div>
      )}

      <p className="radar-estimate" role="status">
        {estimate === null ? "Counting…" : estimate.perWeek === 0 ? "≈ 0 jobs a week right now. Try fewer limits (another place, more contract types)." : `≈ ${estimate.perWeek} job${estimate.perWeek === 1 ? "" : "s"} a week`}
        {estimate && estimate.examples.length > 0 && <small className="muted"> · like {estimate.examples.join("; ")}</small>}
      </p>
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>Save filter</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

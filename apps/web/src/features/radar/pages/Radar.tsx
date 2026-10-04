import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMe } from "../../account/index.ts";
import TaxonomyPicker from "../../../components/TaxonomyPicker.tsx";
import { useToast } from "../../../App.tsx";
import FilterBuilder from "../components/FilterBuilder.tsx";
import MatchCard from "../components/MatchCard.tsx";
import { type Filter, useFilters, useMajors, useMatches, useRadarActions, useRadarStatus, useSaved } from "../api.ts";

// Job Radar (P6-27, P6-28, P6-31), ADHD-first: today's top 5 and nothing else until you ask for more. No filter yet?
// One question: "I study ___" (one click), or build your own. Empty and edge states say what to do, not just "nothing".

const TOP = 5;

function Start() {
  const toast = useToast();
  const majors = useMajors().data ?? [];
  const { fromPreset, create } = useRadarActions();
  const [building, setBuilding] = useState(false);
  const groups = [...new Set(majors.map((m) => m.group))];
  const start = (code: string, label: string) => fromPreset.mutate(code, { onSuccess: () => toast(`Looking for ${label} jobs for you 📡`) });
  if (building) return <FilterBuilder onSave={(name, spec) => create.mutate({ name, spec }, { onSuccess: () => setBuilding(false) })} onCancel={() => setBuilding(false)} busy={create.isPending} />;
  return (
    <div className="card" aria-labelledby="radar-start">
      <h2 id="radar-start" style={{ marginTop: 0 }}>What do you study?</h2>
      <p className="muted">Pick it, and Job Radar looks for internships and first jobs it leads to, with the skills they ask for. You can change everything later.</p>
      {groups.map((g) => (
        <section key={g} aria-label={g}>
          <div className="field-label">{g}</div>
          <div className="row" style={{ gap: 6, marginBottom: 8 }}>
            {majors.filter((m) => m.group === g).map((m) => (
              <button key={m.code} className="chip" disabled={fromPreset.isPending} onClick={() => start(m.code, m.label)}>{m.label}</button>
            ))}
          </div>
        </section>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        <TaxonomyPicker kind="field" label="Another field of study" placeholder="Not listed? Type your field of study…" onPick={(it) => start(it.code, it.label)} />
        <button onClick={() => setBuilding(true)}>Build my own filter</button>
      </div>
    </div>
  );
}

function FilterRow({ f }: { f: Filter }) {
  const { update, remove } = useRadarActions();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <FilterBuilder initial={{ name: f.name, spec: f.spec }} busy={update.isPending} onCancel={() => setEditing(false)}
      onSave={(name, spec) => update.mutate({ id: f.id, name, spec }, { onSuccess: () => setEditing(false) })} />;
  }
  const what = [f.spec.occupations.map((o) => o.label).slice(0, 3).join(", "), f.spec.locations.map((l) => l.label).join(", ")].filter(Boolean).join(" · ");
  return (
    <li className="row" style={{ justifyContent: "space-between" }}>
      <label className="row" style={{ gap: 6 }}>
        <input type="checkbox" checked={f.enabled} onChange={(e) => update.mutate({ id: f.id, enabled: e.target.checked })} aria-label={`${f.name} on`} />
        <span><b>{f.name}</b>{what && <small className="muted"> · {what}</small>}</span>
      </label>
      <span className="row" style={{ gap: 4 }}>
        <button className="ghost" onClick={() => setEditing(true)}>Change</button>
        <button className="ghost" onClick={() => remove.mutate(f.id)} aria-label={`Delete ${f.name}`}>Delete</button>
      </span>
    </li>
  );
}

function Empty() {
  const status = useRadarStatus().data;
  const when = status?.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="card empty-state" role="status">
      <b>No matches yet.</b>
      {status && status.sources === 0 ? (
        <p className="muted">No job sources are switched on. An admin adds them in the admin area.</p>
      ) : status && status.trouble.length > 0 ? (
        <p className="muted">{status.trouble.join(", ")} had trouble on the last check; Job Radar tries again by itself.</p>
      ) : (
        <p className="muted">New jobs are checked every few hours{when ? ` (last: ${when})` : ""}. {status ? `${status.postingsThisWeek} jobs came in this week. ` : ""}If none fit, try widening your filter: another place, more contract types, or fewer must-have skills.</p>
      )}
    </div>
  );
}

export default function Radar() {
  const me = useMe().data;
  if (me && !me.radar) {
    return (
      <>
        <h1>Job Radar</h1>
        <p className="sub">Job Radar is still being tested. For now, add the jobs you find in <Link to="/jobs">Job applications</Link>.</p>
      </>
    );
  }
  return <RadarPage />;
}

function RadarPage() {
  const filters = useFilters();
  const matches = useMatches(20).data;
  const saved = useSaved().data?.items ?? [];
  const { create } = useRadarActions();
  const [more, setMore] = useState(false);
  const [adding, setAdding] = useState(false);

  if (filters.isPending) return <div className="empty" role="status">Loading…</div>;
  const list = filters.data ?? [];
  const items = matches?.items ?? [];
  const top = items.slice(0, TOP);
  const rest = items.slice(TOP);

  return (
    <>
      <h1>Job Radar</h1>
      <p className="sub">Jobs that fit you, from free job sites, with why they fit. Apply in one click: it goes to your Job applications.</p>
      {list.length === 0 ? (
        <Start />
      ) : (
        <>
          <h2>Top picks today</h2>
          {top.length === 0 ? <Empty /> : top.map((m) => <MatchCard key={m.id} match={m} />)}
          {rest.length > 0 && (
            <>
              <button className="ghost" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Show fewer" : `More (${rest.length})`}</button>
              {more && rest.map((m) => <MatchCard key={m.id} match={m} />)}
            </>
          )}
          {saved.length > 0 && (
            <details className="card plain-more">
              <summary>Saved for later ({saved.length})</summary>
              {saved.map((m) => <MatchCard key={m.id} match={m} />)}
            </details>
          )}
          <section className="card" aria-labelledby="radar-filters">
            <h2 id="radar-filters" style={{ marginTop: 0 }}>Your filters</h2>
            <ul className="plain">{list.map((f) => <FilterRow key={f.id} f={f} />)}</ul>
            {adding ? (
              <FilterBuilder busy={create.isPending} onCancel={() => setAdding(false)} onSave={(name, spec) => create.mutate({ name, spec }, { onSuccess: () => setAdding(false) })} />
            ) : (
              <button onClick={() => setAdding(true)}>Add a filter</button>
            )}
          </section>
          <p className="muted tiny">Jobs come from Arbeitnow and company job boards (Greenhouse, Lever); each card names its source and links to the original.</p>
        </>
      )}
    </>
  );
}

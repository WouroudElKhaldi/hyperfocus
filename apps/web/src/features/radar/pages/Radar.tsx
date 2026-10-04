import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMe } from "../../account/index.ts";
import TaxonomyPicker from "../../../components/TaxonomyPicker.tsx";
import { useToast } from "../../../App.tsx";
import FilterBuilder from "../components/FilterBuilder.tsx";
import MatchCard from "../components/MatchCard.tsx";
import { type Filter, useFilters, useMajors, useMatches, useRadarActions, useRadarStatus, useSaved } from "../api.ts";

// Job Radar (P6-27, P6-28, P6-31), ADHD-first: today's top 5 and nothing else until you ask for more. No filter yet?
// One question: i18next.t("radar.iStudy") (one click), or build your own. Empty and edge states say what to do, not just "nothing".

const TOP = 5;

function Start() {
  const toast = useToast();
  const majors = useMajors().data ?? [];
  const { fromPreset, create } = useRadarActions();
  const [building, setBuilding] = useState(false);
  const groups = [...new Set(majors.map((m) => m.group))];
  const start = (code: string, label: string) => fromPreset.mutate(code, { onSuccess: () => toast(i18next.t("radar.lookingFor", { label })) });
  if (building) return <FilterBuilder onSave={(name, spec) => create.mutate({ name, spec }, { onSuccess: () => setBuilding(false) })} onCancel={() => setBuilding(false)} busy={create.isPending} />;
  return (
    <div className="card" aria-labelledby="radar-start">
      <h2 id="radar-start" style={{ marginTop: 0 }}>{i18next.t("radar.whatDoYouStudy")}</h2>
      <p className="muted">{i18next.t("radar.pickItAndJob")}</p>
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
        <TaxonomyPicker kind="field" label={i18next.t("radar.anotherFieldOfStudy")} placeholder={i18next.t("radar.notListedTypeYour")} onPick={(it) => start(it.code, it.label)} />
        <button onClick={() => setBuilding(true)}>{i18next.t("radar.buildMyOwnFilter")}</button>
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
        <button className="ghost" onClick={() => setEditing(true)}>{i18next.t("radar.change")}</button>
        <button className="ghost" onClick={() => remove.mutate(f.id)} aria-label={`Delete ${f.name}`}>{i18next.t("radar.delete")}</button>
      </span>
    </li>
  );
}

function Empty() {
  const status = useRadarStatus().data;
  const when = status?.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="card empty-state" role="status">
      <b>{i18next.t("radar.noMatchesYet")}</b>
      {status && status.sources === 0 ? (
        <p className="muted">{i18next.t("radar.noJobSourcesAre")}</p>
      ) : status && status.trouble.length > 0 ? (
        <p className="muted">{status.trouble.join(", ")} had trouble on the last check; Job Radar tries again by itself.</p>
      ) : (
        <p className="muted">New jobs are checked every few hours{when ? ` (last: ${when})` : ""}. {status ? `${status.postingsThisWeek} jobs came in this week. ` : ""}If none fit, try widening your filter: another place, more contract types, or fewer must-have skills.</p>
      )}
    </div>
  );
}

export default function Radar() {
  useTranslation(); // (re-renders this page when the language changes)
  const me = useMe().data;
  if (me && !me.radar) {
    return (
      <>
        <h1>{i18next.t("radar.jobRadar")}</h1>
        <p className="sub">{i18next.t("radar.jobRadarIsStill")} <Link to="/jobs">{i18next.t("radar.jobApplications")}</Link>.</p>
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

  if (filters.isPending) return <div className="empty" role="status">{i18next.t("radar.loading")}</div>;
  const list = filters.data ?? [];
  const items = matches?.items ?? [];
  const top = items.slice(0, TOP);
  const rest = items.slice(TOP);

  return (
    <>
      <h1>{i18next.t("radar.jobRadar")}</h1>
      <p className="sub">{i18next.t("radar.jobsThatFitYou")}</p>
      {list.length === 0 ? (
        <Start />
      ) : (
        <>
          <h2>{i18next.t("radar.topPicksToday")}</h2>
          {top.length === 0 ? <Empty /> : top.map((m) => <MatchCard key={m.id} match={m} />)}
          {rest.length > 0 && (
            <>
              <button className="ghost" aria-expanded={more} onClick={() => setMore(!more)}>{more ? i18next.t("radar.showFewer") : `More (${rest.length})`}</button>
              {more && rest.map((m) => <MatchCard key={m.id} match={m} />)}
            </>
          )}
          {saved.length > 0 && (
            <details className="card plain-more">
              <summary>{i18next.t("radar.savedForLater", { count: saved.length })}</summary>
              {saved.map((m) => <MatchCard key={m.id} match={m} />)}
            </details>
          )}
          <section className="card" aria-labelledby="radar-filters">
            <h2 id="radar-filters" style={{ marginTop: 0 }}>{i18next.t("radar.yourFilters")}</h2>
            <ul className="plain">{list.map((f) => <FilterRow key={f.id} f={f} />)}</ul>
            {adding ? (
              <FilterBuilder busy={create.isPending} onCancel={() => setAdding(false)} onSave={(name, spec) => create.mutate({ name, spec }, { onSuccess: () => setAdding(false) })} />
            ) : (
              <button onClick={() => setAdding(true)}>{i18next.t("radar.addAFilter")}</button>
            )}
          </section>
          <p className="muted tiny">{i18next.t("radar.jobsComeFromArbeitnow")}</p>
        </>
      )}
    </>
  );
}

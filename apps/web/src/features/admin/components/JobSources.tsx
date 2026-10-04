import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../api.ts";
import { useApi } from "../../../api/hooks.ts";
import { keyOf } from "../../../api/query.ts";

// Job sources (P6-18): how each one is doing, switch it off or on, check it soon, add a company's Greenhouse or Lever
// job board. A board read from its web pages (no API) needs its written permission recorded before it can be switched on.

const STATUS = { ok: i18next.t("admin.working"), failing: i18next.t("admin.failing"), waiting: i18next.t("admin.notCheckedYet"), off: i18next.t("admin.off") } as const;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");

export default function JobSources() {
  useTranslation(); // (re-renders this page when the language changes)
  const sources = useApi("/admin/job-sources").data ?? [];
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: keyOf("/admin/job-sources") });
  const change = useMutation({
    mutationFn: ({ id, ...b }: { id: number; enabled?: boolean; checkSoon?: boolean; permission?: string }) => api.patch(`/admin/job-sources/${id}`, b),
    onSettled: refresh,
  });
  const add = useMutation({ mutationFn: (b: { kind: "greenhouse" | "lever"; board: string }) => api.post("/admin/job-sources", b), onSuccess: refresh });
  const [kind, setKind] = useState<"greenhouse" | "lever">("greenhouse");
  const [board, setBoard] = useState("");
  const [allowed, setAllowed] = useState<Record<number, string>>({});

  return (
    <div className="card">
      <h2>{i18next.t("admin.jobSources")}</h2>
      <p className="muted">{i18next.t("admin.whereJobRadarGets")}</p>
      <table className="table">
        <thead><tr><th>{i18next.t("admin.source")}</th><th>{i18next.t("admin.state")}</th><th>{i18next.t("admin.lastCheck")}</th><th>{i18next.t("admin.shownNow")}</th><th>{i18next.t("admin.newThisWeek")}</th><th /></tr></thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td>{s.name}<div className="muted"><small>{s.key}</small></div></td>
              <td>
                {STATUS[s.status]}
                {s.lastError && <div className="muted"><small>{s.lastError}</small></div>}
                {s.permission !== null && (
                  s.permission ? (
                    <div className="muted"><small>Permission: {s.permission}</small></div>
                  ) : (
                    <form className="row" onSubmit={(e) => { e.preventDefault(); const p = (allowed[s.id] ?? "").trim(); if (p) change.mutate({ id: s.id, permission: p }); }}>
                      <label htmlFor={`perm-${s.id}`} className="sr-only">Permission for {s.name}</label>
                      <input id={`perm-${s.id}`} placeholder={i18next.t("admin.whoAllowedItAnd")} value={allowed[s.id] ?? ""} onChange={(e) => setAllowed({ ...allowed, [s.id]: e.target.value })} />
                      <button type="submit">{i18next.t("admin.recordPermission")}</button>
                    </form>
                  )
                )}
              </td>
              <td>{when(s.lastRunAt)}{s.lastBatch && <div className="muted"><small>last batch: {s.lastBatch.received} in, {s.lastBatch.created} new, {s.lastBatch.duplicates} repeats{s.lastBatch.failed ? `, ${s.lastBatch.failed} failed` : ""}</small></div>}</td>
              <td>{s.postings}</td>
              <td>{s.newThisWeek}</td>
              <td className="row">
                <button disabled={change.isPending || (s.permission === "" && !s.enabled)} title={s.permission === "" ? i18next.t("admin.recordTheBoardS") : undefined} onClick={() => change.mutate({ id: s.id, enabled: !s.enabled })}>{s.enabled ? i18next.t("admin.switchOff") : i18next.t("admin.switchOn")}</button>
                {s.enabled && <button className="ghost" disabled={change.isPending} onClick={() => change.mutate({ id: s.id, checkSoon: true })}>{i18next.t("admin.checkSoon")}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (board.trim()) add.mutate({ kind, board: board.trim() }, { onSuccess: () => setBoard("") });
        }}
      >
        <label htmlFor="src-kind" className="sr-only">{i18next.t("admin.kindOfJobBoard")}</label>
        <select id="src-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="greenhouse">Greenhouse</option>
          <option value="lever">Lever</option>
        </select>
        <label htmlFor="src-board" className="sr-only">{i18next.t("admin.boardName")}</label>
        <input id="src-board" placeholder={kind === "greenhouse" ? "name in boards.greenhouse.io/<name>" : "name in jobs.lever.co/<name>"} value={board} onChange={(e) => setBoard(e.target.value)} />
        <button type="submit" disabled={add.isPending}>{i18next.t("admin.addJobBoard")}</button>
      </form>
    </div>
  );
}

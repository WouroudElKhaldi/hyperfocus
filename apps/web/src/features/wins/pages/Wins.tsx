import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { type FormEvent, useMemo, useState } from "react";
import { useApiChange } from "../../../api/hooks.ts";
import { useToast } from "../../../App.tsx";
import type { Win, WinsSummary } from "../../../types.ts";
import { useAddWin, useDeleteWin, useWins } from "../api.ts";

const ICON: Record<string, string> = { win: "🏆", task: "✅", post: "💼", study: "📚" };
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

export default function Wins() {
  useTranslation(); // (re-renders this page when the language changes)
  const toast = useToast();
  const wins = useWins().data ?? [];
  const addWin = useAddWin();
  const deleteWin = useDeleteWin();
  const [text, setText] = useState("");
  const [summary, setSummary] = useState<WinsSummary | null>(null);
  const summarize = useApiChange("post", "/wins/summary", { onSuccess: setSummary });
  const busy = summarize.isPending;

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addWin.mutate(text, { onSuccess: () => { setText(""); toast(i18next.t("wins.loggedYouDidThat")); } });
  };
  const remove = (w: Win) => { if (w.winId) deleteWin.mutate(w.winId); };
  const makeSummary = () => summarize.mutate(undefined);
  const copy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary.bullets.map((b) => `• ${b}`).join("\n") + "\n\n" + summary.paragraph);
    toast(i18next.t("wins.copied"));
  };

  const days = useMemo(() => {
    const g: { k: string; items: Win[] }[] = [];
    for (const w of wins) {
      const k = dayLabel(w.date);
      let d = g.find((x) => x.k === k);
      if (!d) g.push((d = { k, items: [] }));
      d.items.push(w);
    }
    return g;
  }, [wins]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{i18next.t("wins.wins")}</h1>
          <p className="sub">{i18next.t("wins.proofOfWhatYou")}</p>
        </div>
        <button className="primary big" disabled={busy || wins.length < 3} onClick={makeSummary}>{busy ? i18next.t("wins.writing") : i18next.t("wins.makeMyTalkingPoints")}</button>
      </div>

      <form className="card row" onSubmit={add}>
        <input className="grow" placeholder={i18next.t("wins.somethingIDidThat")} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={!text.trim()}>{i18next.t("wins.addWin")}</button>
      </form>

      {summary && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>{i18next.t("wins.forAReviewA")}</h2>
            <div className="row"><button onClick={copy}>{i18next.t("wins.copy")}</button><button className="ghost" onClick={() => setSummary(null)}>{i18next.t("wins.hide")}</button></div>
          </div>
          {summary.bullets.map((b, i) => <p key={i} style={{ margin: "var(--s-1) 0" }}>• {b}</p>)}
          <p className="pre" style={{ marginTop: "var(--s-3)" }}>{summary.paragraph}</p>
          <p className="muted tiny">{i18next.t("wins.builtOnlyFromYour")}</p>
        </div>
      )}

      {days.length === 0 && <div className="empty">{i18next.t("wins.nothingYetWriteYour")}</div>}
      {days.map((d) => (
        <div className="card" key={d.k}>
          <h2>{d.k}</h2>
          {d.items.map((w) => (
            <div className="item" key={w.id}>
              <span>{ICON[w.kind]}</span>
              <div className="grow">{w.text}</div>
              {w.manual && <button className="ghost" onClick={() => remove(w)}>✕</button>}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

import { useState } from "react";
import { createPortal } from "react-dom";
import { api, errorOf } from "../api.ts";
import type { StuckHelp } from "../types.ts";
import { useToast } from "../App.tsx";
import { useTranslation } from "react-i18next";
import Icon from "./Icon.tsx";

const ENERGY = ["low", "ok", "high"] as const;

export default function Stuck({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [energy, setEnergy] = useState("ok");
  const [blocker, setBlocker] = useState("");
  const [out, setOut] = useState<StuckHelp | null>(null);
  const [busy, setBusy] = useState(false);

  const help = async () => {
    setBusy(true);
    try { setOut(await api.post("/stuck", { energy, blocker })); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };
  const close = () => { setOpen(false); setOut(null); setBlocker(""); };
  const addTask = async () => { if (!out) return; await api.post("/tasks", { title: out.step, today: true }); toast(t("stuck.added")); close(); };

  return (
    <>
      <button className={"stuck-btn" + (inline ? " inline" : "")} onClick={() => setOpen(true)}><Icon name="sos" size={17} /><span className="lbl">{t("stuck.button")}</span></button>
      {open && createPortal(
        <div className="modal-bg" onClick={close}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{t("stuck.title")}</h2>
              <button className="ghost" onClick={close} aria-label={t("stuck.close")}>✕</button>
            </div>

            {!out ? (
              <>
                <p className="muted">{t("stuck.energy")}</p>
                <div className="tabs">
                  {ENERGY.map((k) => <button key={k} className={energy === k ? "on" : ""} onClick={() => setEnergy(k)}>{t(`stuck.${k}`)}</button>)}
                </div>
                <p className="muted">{t("stuck.blocker")}</p>
                <textarea style={{ minHeight: 60 }} autoFocus value={blocker} onChange={(e) => setBlocker(e.target.value)}
                  placeholder={t("stuck.placeholder")} />
                <button className="primary big" style={{ marginTop: "var(--s-3)" }} disabled={busy} onClick={help}>{busy ? t("stuck.thinking") : t("stuck.help")}</button>
              </>
            ) : (
              <>
                <p style={{ margin: "var(--s-2) 0" }}>{out.validation}</p>
                <div className="break-note" style={{ fontSize: "1.05rem" }}>👉 {out.step}</div>
                {out.pick && <p className="muted" style={{ marginTop: "var(--s-2)" }}>{t("stuck.pick")} <b>{out.pick}</b></p>}
                {out.ifStillStuck && <p className="muted">{t("stuck.smaller", { step: out.ifStillStuck })}</p>}
                <div className="row" style={{ marginTop: "var(--s-3)" }}>
                  <button className="primary" onClick={close}>{t("stuck.start")}</button>
                  <button onClick={addTask}>{t("stuck.putInToday")}</button>
                  <button className="ghost" onClick={() => setOut(null)}>{t("stuck.again")}</button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

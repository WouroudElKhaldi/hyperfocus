import { useState } from "react";
import { createPortal } from "react-dom";
import { api, errorOf } from "../api.ts";
import type { StuckHelp } from "../types.ts";
import { useToast } from "../App.tsx";
import Icon from "./Icon.tsx";

const ENERGY: [string, string][] = [["low", "🪫 Low"], ["ok", "🙂 Okay"], ["high", "⚡ Good"]];

export default function Stuck({ inline = false }: { inline?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [energy, setEnergy] = useState("ok");
  const [blocker, setBlocker] = useState("");
  const [out, setOut] = useState<StuckHelp | null>(null);
  const [busy, setBusy] = useState(false);

  const help = async () => {
    setBusy(true);
    try { setOut(await api.post<StuckHelp>("/stuck", { energy, blocker })); }
    catch (caught) { const e = errorOf(caught); toast(e.message, "err"); }
    setBusy(false);
  };
  const close = () => { setOpen(false); setOut(null); setBlocker(""); };
  const addTask = async () => { if (!out) return; await api.post("/tasks", { title: out.step, today: true }); toast("Added to Today ✅"); close(); };

  return (
    <>
      <button className={"stuck-btn" + (inline ? " inline" : "")} onClick={() => setOpen(true)}><Icon name="sos" size={17} /><span className="lbl">I'm stuck</span></button>
      {open && createPortal(
        <div className="modal-bg" onClick={close}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>It's okay. Let's just start. 💜</h2>
              <button className="ghost" onClick={close}>✕</button>
            </div>

            {!out ? (
              <>
                <p className="muted">How's your energy right now?</p>
                <div className="tabs">
                  {ENERGY.map(([k, label]) => <button key={k} className={energy === k ? "on" : ""} onClick={() => setEnergy(k)}>{label}</button>)}
                </div>
                <p className="muted">What's in the way? (optional, a few words is enough)</p>
                <textarea style={{ minHeight: 60 }} autoFocus value={blocker} onChange={(e) => setBlocker(e.target.value)}
                  placeholder="e.g. too many things, I don't know where to begin, I'm scared it won't be good enough…" />
                <button className="primary big" style={{ marginTop: "var(--s-3)" }} disabled={busy} onClick={help}>{busy ? "Thinking…" : "Help me start"}</button>
              </>
            ) : (
              <>
                <p style={{ margin: "var(--s-2) 0" }}>{out.validation}</p>
                <div className="break-note" style={{ fontSize: "1.05rem" }}>👉 {out.step}</div>
                {out.pick && <p className="muted" style={{ marginTop: "var(--s-2)" }}>A task that fits your energy: <b>{out.pick}</b></p>}
                {out.ifStillStuck && <p className="muted">Still stuck? Even smaller: {out.ifStillStuck}</p>}
                <div className="row" style={{ marginTop: "var(--s-3)" }}>
                  <button className="primary" onClick={close}>Okay, starting</button>
                  <button onClick={addTask}>➕ Put this step in Today</button>
                  <button className="ghost" onClick={() => setOut(null)}>Try again</button>
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

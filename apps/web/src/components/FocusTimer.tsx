import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../App.tsx";

// The focus round: 25 minutes (or a tiny 5-minute start), then a nudge to stand up. On Today and on the Study page.

export default function FocusTimer() {
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();
  const id = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!running) return;
    id.current = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => clearInterval(id.current);
  }, [running]);
  useEffect(() => {
    if (secs <= 0 && running) {
      setRunning(false);
      setSecs(25 * 60);
      toast(t("focus.doneToast"));
    }
  }, [secs, running, toast, t]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <section className="card" aria-labelledby="focus-round">
      <h2 id="focus-round">{t("focus.title")}</h2>
      <div className="timer">
        {mm}:{ss}
      </div>
      <div className="row" style={{ marginTop: "var(--s-2)" }}>
        <button className="primary" onClick={() => setRunning((r) => !r)}>
          {running ? t("focus.pause") : t("focus.start")}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setSecs(5 * 60);
          }}
        >
          {t("focus.five")}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setSecs(25 * 60);
          }}
        >
          {t("focus.twentyFive")}
        </button>
      </div>
      <p className="muted">{t("focus.hint")}</p>
    </section>
  );
}

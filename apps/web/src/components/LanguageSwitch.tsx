import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language, setLanguage } from "../i18n/index.ts";

// Pick the app's language (P3-28): in the top bar, the phone's More sheet and Settings. Each language is written in
// itself, so you can find yours whatever the app is showing now.

export default function LanguageSwitch({ id = "lang-switch", compact = false }: { id?: string; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : "en";
  return (
    <span className="lang-switch">
      <label htmlFor={id} className={compact ? "sr-only" : undefined}>{compact ? t("shell.language") : `🌐 ${t("shell.language")}`}</label>
      <select id={id} value={current} onChange={(e) => setLanguage(e.target.value as Language)} title={t("shell.language")}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{compact ? `🌐 ${l.name}` : l.name}</option>)}
      </select>
    </span>
  );
}

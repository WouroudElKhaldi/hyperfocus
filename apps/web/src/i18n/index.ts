import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { ar } from "./ar.ts";
import { arLb } from "./ar-lb.ts";
import { en, type Strings } from "./en.ts";
import { type Language, deviceLanguage } from "./device.ts";
import { fr } from "./fr.ts";
import { accented, pseudo, rtl } from "./pseudo.ts";

// Translation (P3-19, P3-28), with i18next (MIT). Four languages (interview 1): English, French ("tu"), standard Arabic
// and Lebanese Arabic. By default the device's language; the choice (top bar or Settings) is remembered in this browser.
// Arabic reads right to left: <html> gets lang and dir, so the browser and the CSS follow. Two pseudo-languages remain
// for tests (?lang=en-XA, ?lang=ar-XB). Words not translated yet fall back to English.

declare module "i18next" {
  interface CustomTypeOptions { resources: { translation: Strings } }
}

/** The languages people can pick, each named in itself. */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "ar", name: "العربية" },
  { code: "ar-LB", name: "اللبنانية" },
] as const;
export type { Language } from "./device.ts";
const TEST_LANGS = ["en-XA", "ar-XB"];
const KNOWN = [...LANGUAGES.map((l) => l.code as string), ...TEST_LANGS];
const KEY = "lang";

const chosen = () => {
  const asked = new URLSearchParams(window.location.search).get("lang");
  try {
    if (asked && KNOWN.includes(asked)) localStorage.setItem(KEY, asked);
    const saved = asked ?? localStorage.getItem(KEY);
    return saved && KNOWN.includes(saved) ? saved : deviceLanguage(navigator.languages ?? [navigator.language]);
  } catch {
    return asked && KNOWN.includes(asked) ? asked : deviceLanguage(navigator.languages ?? [navigator.language]);
  }
};

const isRtl = (code: string) => code.startsWith("ar");
function setPageLanguage(code: string) {
  const base = code === "ar-XB" ? "ar" : code === "en-XA" ? "en" : code;
  document.documentElement.lang = base;
  document.documentElement.dir = isRtl(code) ? "rtl" : "ltr";
}

const lng = chosen();
void i18next.use(initReactI18next).init({
  lng,
  fallbackLng: { "ar-LB": ["ar", "en"], default: ["en"] },
  resources: {
    en: { translation: en }, fr: { translation: fr }, ar: { translation: ar }, "ar-LB": { translation: arLb },
    "en-XA": { translation: pseudo(en, accented) }, "ar-XB": { translation: pseudo(en, rtl) },
  },
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false, // the words are all here, so start at once (no flash of untranslated keys)
});
setPageLanguage(lng);

/** Switch the language now (no reload) and remember it in this browser. */
export function setLanguage(code: Language) {
  try { localStorage.setItem(KEY, code); } catch { /* storage may be unavailable */ }
  void i18next.changeLanguage(code);
  setPageLanguage(code);
}

export default i18next;

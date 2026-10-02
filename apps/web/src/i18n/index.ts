import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { en, type Strings } from "./en.ts";
import { accented, pseudo, rtl } from "./pseudo.ts";

// Translation (P3-19), with i18next (MIT). English is the only real language for now; the two pseudo-languages exist
// to test that words are translatable and that the layout works right to left. Pick one with ?lang=en-XA or ?lang=ar-XB
// (remembered in this browser). The <html> element gets lang and dir, so the browser and the CSS follow.

declare module "i18next" {
  interface CustomTypeOptions { resources: { translation: Strings } }
}

export const LANGS = ["en", "en-XA", "ar-XB"] as const;
const KEY = "lang";
const pick = () => {
  const asked = new URLSearchParams(window.location.search).get("lang");
  try {
    if (asked) localStorage.setItem(KEY, asked);
    return asked ?? localStorage.getItem(KEY) ?? "en";
  } catch { return asked ?? "en"; }
};

const lng = (LANGS as readonly string[]).includes(pick()) ? pick() : "en";
void i18next.use(initReactI18next).init({
  lng,
  fallbackLng: "en",
  resources: { en: { translation: en }, "en-XA": { translation: pseudo(en, accented) }, "ar-XB": { translation: pseudo(en, rtl) } },
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false, // the words are all here, so start at once (no flash of untranslated keys)
});
document.documentElement.lang = lng === "ar-XB" ? "ar" : "en";
document.documentElement.dir = i18next.dir(lng === "ar-XB" ? "ar" : "en");

export default i18next;

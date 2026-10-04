// The device's language, as one of ours (P3-28): Lebanese Arabic, other Arabic, French, else English.
export type Language = "en" | "fr" | "ar" | "ar-LB";

export function deviceLanguage(list: readonly string[]): Language {
  for (const raw of list) {
    const l = raw.toLowerCase();
    if (l === "ar-lb") return "ar-LB";
    if (l.startsWith("ar")) return "ar";
    if (l.startsWith("fr")) return "fr";
    if (l.startsWith("en")) return "en";
  }
  return "en";
}

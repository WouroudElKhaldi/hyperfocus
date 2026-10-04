import i18next from "i18next";

// The locale for dates and times (P3-28): the chosen language, with Western digits (1, 2, 3) in Arabic too, as people
// write them in Lebanon, so a date and the calendar around it never mix digit styles.
export const dateLocale = () => (i18next.language.startsWith("ar") ? `${i18next.language}-u-nu-latn` : i18next.language);

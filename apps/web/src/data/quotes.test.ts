import { describe, expect, it } from "vitest";
import { QUOTE_CATEGORIES, QUOTES } from "./quotes.ts";
import { QUOTE_LABELS, QUOTES_BY_LANG } from "./quotes.i18n.ts";

// The quotes are translated line by line: each language must have the same lines, in the same order, as English.
describe("quotes in every language", () => {
  for (const [lang, lines] of Object.entries(QUOTES_BY_LANG)) {
    it(`${lang}: every group has every line, and a label`, () => {
      for (const c of QUOTE_CATEGORIES) {
        expect(lines[c.id]?.length, `${lang} ${c.id}`).toBe(QUOTES[c.id]?.length);
        expect(QUOTE_LABELS[lang]?.[c.id]).toBeTruthy();
      }
    });
  }
});

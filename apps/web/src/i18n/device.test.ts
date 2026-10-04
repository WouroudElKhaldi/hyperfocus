import { describe, expect, it } from "vitest";
import { deviceLanguage } from "./device.ts";

describe("the device's language (P3-28)", () => {
  it("is one of ours: Lebanese Arabic, Arabic, French, else English; the first known one wins", () => {
    expect(deviceLanguage(["ar-LB", "en"])).toBe("ar-LB");
    expect(deviceLanguage(["ar-SA"])).toBe("ar");
    expect(deviceLanguage(["fr-CA", "en"])).toBe("fr");
    expect(deviceLanguage(["de-DE", "fr-FR"])).toBe("fr");
    expect(deviceLanguage(["de-DE"])).toBe("en");
    expect(deviceLanguage([])).toBe("en");
  });
});

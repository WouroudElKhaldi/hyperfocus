import { describe, expect, it } from "vitest";
import { UpdateProfileInput, UpdateSettingsInput } from "../src/index.ts";

// The profile and settings rules the API used before P2-20 (in apps/api/src/index.ts and notify.ts), now as schemas.

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("profile", () => {
  it("trims, shortens and turns values into text; only the fields sent are returned", () => {
    const r = UpdateProfileInput.parse({ name: "  Ro  ", about: "x".repeat(700), role: 42, avatar: "#AABBCC" });
    expect(r).toEqual({ name: "Ro", about: "x".repeat(600), role: "42", avatar: "#aabbcc" });
  });
  it("accepts an empty email or link (clearing it), refuses ones that look wrong", () => {
    expect(UpdateProfileInput.parse({ email: "  ", linkedin: "" })).toEqual({ email: "", linkedin: "" });
    expect(firstError(UpdateProfileInput.safeParse({ email: "nope" }))).toBe("That email doesn't look right.");
    expect(firstError(UpdateProfileInput.safeParse({ linkedin: "linkedin.com/in/x" }))).toBe("The LinkedIn link should start with https://");
    expect(firstError(UpdateProfileInput.safeParse({ avatar: "red" }))).toBe("Pick a color for your avatar.");
    expect(firstError(UpdateProfileInput.safeParse({ avatar: null }))).toBe("Pick a color for your avatar.");
  });
  it("reports the email first, then the link, then the avatar", () => {
    expect(firstError(UpdateProfileInput.safeParse({ avatar: "red", linkedin: "x", email: "nope" }))).toBe("That email doesn't look right.");
    expect(firstError(UpdateProfileInput.safeParse({ avatar: "red", linkedin: "x" }))).toBe("The LinkedIn link should start with https://");
  });
});

describe("settings", () => {
  it("keeps valid values and clamps the break reminder to 15–180 minutes", () => {
    expect(UpdateSettingsInput.parse({ reminders: false, breakEveryMin: 5, morningAt: "07:30" })).toEqual({ reminders: false, breakEveryMin: 15, morningAt: "07:30" });
    expect(UpdateSettingsInput.parse({ breakEveryMin: 999 }).breakEveryMin).toBe(180);
    expect(UpdateSettingsInput.parse({ breakEveryMin: 49.6 }).breakEveryMin).toBe(50);
  });
  it("quietly ignores wrong types and impossible times (the old setting stays)", () => {
    const r = UpdateSettingsInput.parse({ reminders: "yes", breakEveryMin: null, morningAt: "25:00" });
    expect(r).toEqual({ reminders: undefined, breakEveryMin: undefined, morningAt: undefined });
  });
});

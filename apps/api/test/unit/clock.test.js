import { describe, expect, it } from "vitest";
import { clockIn, inQuietHours, reached, validTimeZone } from "../../src/clock.ts";

// P5-11: each person's clock: their time zone decides quiet hours, the morning note and the digest.

const at = new Date("2026-10-03T19:30:00Z"); // 22:30 in Beirut (UTC+3 in October), 15:30 in New York

describe("a person's clock", () => {
  it("tells the day and time in their time zone", () => {
    expect(clockIn("Asia/Beirut", at)).toMatchObject({ day: "2026-10-03", time: "22:30" });
    expect(clockIn("America/New_York", at)).toMatchObject({ day: "2026-10-03", time: "15:30" });
    expect(clockIn("Pacific/Kiritimati", at)).toMatchObject({ day: "2026-10-04", time: "09:30" }); // already tomorrow
    expect(validTimeZone("Mars/Base")).toBe(false);
  });

  it("quiet hours, including over midnight", () => {
    expect(inQuietHours("22:00", "07:00", "Asia/Beirut", at)).toBe(true);
    expect(inQuietHours("22:00", "07:00", "America/New_York", at)).toBe(false);
    expect(inQuietHours("13:00", "16:00", "America/New_York", at)).toBe(true);
    expect(inQuietHours("", "", "Asia/Beirut", at)).toBe(false);
    expect(inQuietHours("22:00", "22:00", "Asia/Beirut", at)).toBe(false);
  });

  it("has a time been reached today", () => {
    expect(reached("09:00", "Asia/Beirut", at)).toBe(true);
    expect(reached("23:00", "Asia/Beirut", at)).toBe(false);
  });
});

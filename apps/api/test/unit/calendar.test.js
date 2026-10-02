import { describe, expect, it } from "vitest";
import { addDays, freeWindows, occurrenceDays } from "../../src/modules/calendar/calendar.ts";
import { cleanEvent } from "../../src/modules/calendar/event-rules.ts";

// The calendar's rules (P2-12), tested without a database. Days are local "YYYY-MM-DD" strings.
// 2026-10-05 is a Monday.

const ev = (over) => ({ day: "2026-10-05", repeat: "none", repeatUntil: "", exceptions: "", ...over });

describe("repeats", () => {
  it("a one-off event happens on its day only, if that day is in the range", () => {
    expect(occurrenceDays(ev(), "2026-10-01", "2026-10-31")).toEqual(["2026-10-05"]);
    expect(occurrenceDays(ev(), "2026-10-06", "2026-10-31")).toEqual([]);
  });
  it("daily, weekdays, weekly and monthly", () => {
    expect(occurrenceDays(ev({ repeat: "daily" }), "2026-10-04", "2026-10-07")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    // Friday 9th to Tuesday 13th: no weekend
    expect(occurrenceDays(ev({ repeat: "weekdays" }), "2026-10-09", "2026-10-13")).toEqual(["2026-10-09", "2026-10-12", "2026-10-13"]);
    expect(occurrenceDays(ev({ repeat: "weekly" }), "2026-10-01", "2026-10-31")).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(occurrenceDays(ev({ repeat: "monthly" }), "2026-10-01", "2027-01-31")).toEqual(["2026-10-05", "2026-11-05", "2026-12-05", "2027-01-05"]);
  });
  it("never before the first day, and not after repeatUntil", () => {
    expect(occurrenceDays(ev({ repeat: "weekly", repeatUntil: "2026-10-19" }), "2026-09-01", "2026-12-31")).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
  });
  it("skipped days are left out, one-off events included", () => {
    expect(occurrenceDays(ev({ repeat: "weekly", exceptions: "2026-10-12,2026-10-26" }), "2026-10-01", "2026-10-31")).toEqual(["2026-10-05", "2026-10-19"]);
    expect(occurrenceDays(ev({ exceptions: "2026-10-05" }), "2026-10-01", "2026-10-31")).toEqual([]);
  });
  it("crosses month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("free time", () => {
  const occ = (day, startTime, endTime, allDay = false) => ({ day, startTime, endTime, allDay });
  const earlyMorning = new Date(2026, 9, 5, 6, 0); // Monday 06:00, before the day opens

  it("the gaps of at least 45 minutes between 09:00 and 21:00, around timed events", () => {
    const w = freeWindows([occ("2026-10-05", "10:00", "12:00"), occ("2026-10-05", "12:30", "20:30")], ["2026-10-05"], earlyMorning);
    expect(w).toEqual([{ day: "2026-10-05", from: "09:00", to: "10:00" }]); // 12:00-12:30 and 20:30-21:00 are too short
  });
  it("all-day events don't block time; an event without an end takes an hour", () => {
    const w = freeWindows([occ("2026-10-06", "", "", true), occ("2026-10-06", "09:00", "")], ["2026-10-06"], earlyMorning);
    expect(w).toEqual([{ day: "2026-10-06", from: "10:00", to: "21:00" }]);
  });
  it("today starts from now + 15 minutes, rounded up to the half hour", () => {
    expect(freeWindows([], ["2026-10-05"], new Date(2026, 9, 5, 14, 20))).toEqual([{ day: "2026-10-05", from: "15:00", to: "21:00" }]);
  });
});

describe("event checks", () => {
  const firstError = (b, partial) => cleanEvent(b, partial).error;
  it("a new event needs a title and a real day; no start time means all day", () => {
    expect(firstError({ day: "2026-10-05" })).toBe("Give the event a title.");
    expect(firstError({ title: "x", day: "Monday" })).toBe("Pick a valid date.");
    expect(cleanEvent({ title: "  Exam  ", day: "2026-10-05" }).data).toEqual({ title: "Exam", day: "2026-10-05", allDay: true });
  });
  it("times look like 14:30 and the end comes after the start", () => {
    expect(firstError({ title: "x", day: "2026-10-05", startTime: "9:00" })).toBe("Times look like 14:30.");
    expect(firstError({ title: "x", day: "2026-10-05", startTime: "10:00", endTime: "10:00" })).toBe("The end must be after the start.");
    expect(cleanEvent({ title: "x", day: "2026-10-05", allDay: true, startTime: "10:00" }).data).toMatchObject({ allDay: true, startTime: "", endTime: "" });
  });
  it("unknown categories, repeats and reminder times fall back", () => {
    expect(cleanEvent({ title: "x", day: "2026-10-05", category: "party", repeat: "hourly", remindMin: 10081 }).data).toMatchObject({ category: "event", repeat: "none", remindMin: -1 });
    expect(cleanEvent({ title: "x", day: "2026-10-05", remindMin: "15.4" }).data?.remindMin).toBe(15);
  });
  it("a change only checks and returns the fields sent", () => {
    expect(cleanEvent({ location: "x".repeat(250) }, true).data).toEqual({ location: "x".repeat(200) });
    expect(firstError({ title: " " }, true)).toBe("Give the event a title.");
    expect(firstError({ repeatUntil: "soon" }, true)).toBe("Pick a valid end date for the repeat.");
  });
});

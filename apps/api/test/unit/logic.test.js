import { describe, expect, it } from "vitest";
import { occurrenceDays } from "../../src/modules/calendar/calendar.ts";
import { CRISIS_FALLBACK, isCrisis } from "../../src/modules/chat/crisis.ts";
import { cleanHtml, textOf } from "../../src/modules/emails/html.ts";
import { levelFor, studyXp, taskXp } from "../../src/pet.ts";
import { nextOccurrence } from "../../src/reminders.ts";

// Fast tests of the pure rules behind reminders, the calendar, XP, the crisis check and email cleaning.

const local = (s) => new Date(s); // "2026-10-02T09:00:00" is read as local time, like the app does

describe("nextOccurrence (repeating reminders)", () => {
  it("daily moves to the next day after now", () => {
    expect(nextOccurrence(local("2026-10-01T09:00:00"), "daily", local("2026-10-01T09:30:00"))).toEqual(local("2026-10-02T09:00:00"));
  });
  it("skips missed days, landing on the first time after now", () => {
    expect(nextOccurrence(local("2026-09-01T09:00:00"), "daily", local("2026-10-01T10:00:00"))).toEqual(local("2026-10-02T09:00:00"));
  });
  it("weekdays jumps from Friday to Monday", () => {
    expect(nextOccurrence(local("2026-10-02T08:00:00"), "weekdays", local("2026-10-02T08:01:00"))).toEqual(local("2026-10-05T08:00:00"));
  });
  it("weekly adds whole weeks", () => {
    expect(nextOccurrence(local("2026-10-01T18:00:00"), "weekly", local("2026-10-10T00:00:00"))).toEqual(local("2026-10-15T18:00:00"));
  });
});

describe("occurrenceDays (calendar repeats)", () => {
  const ev = (o) => ({ day: "2026-10-01", repeat: "none", repeatUntil: "", exceptions: "", ...o }); // 2026-10-01 is a Thursday
  it("a one-off event appears only on its day, inside the range", () => {
    expect(occurrenceDays(ev({}), "2026-09-30", "2026-10-05")).toEqual(["2026-10-01"]);
    expect(occurrenceDays(ev({}), "2026-10-02", "2026-10-05")).toEqual([]);
  });
  it("daily, until the end date", () => {
    expect(occurrenceDays(ev({ repeat: "daily", repeatUntil: "2026-10-03" }), "2026-09-01", "2026-12-01")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });
  it("weekdays leaves out the weekend", () => {
    expect(occurrenceDays(ev({ repeat: "weekdays" }), "2026-10-01", "2026-10-06")).toEqual(["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"]);
  });
  it("weekly and monthly keep the weekday / day of month", () => {
    expect(occurrenceDays(ev({ repeat: "weekly" }), "2026-10-01", "2026-10-20")).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
    expect(occurrenceDays(ev({ repeat: "monthly" }), "2026-10-01", "2026-12-31")).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
  });
  it("skipped days are left out", () => {
    expect(occurrenceDays(ev({ repeat: "daily", exceptions: "2026-10-02" }), "2026-10-01", "2026-10-03")).toEqual(["2026-10-01", "2026-10-03"]);
  });
  it("never starts before the event's first day", () => {
    expect(occurrenceDays(ev({ repeat: "daily" }), "2026-09-28", "2026-10-01")).toEqual(["2026-10-01"]);
  });
});

describe("pet XP rules", () => {
  it("task points follow importance", () => {
    expect([taskXp("low"), taskXp("normal"), taskXp("high"), taskXp("urgent")]).toEqual([1, 3, 6, 10]);
    // P3-24: the effort counts: +1 per step done, up to 6
    expect([taskXp("normal", 2), taskXp("low", 5), taskXp("high", 20), taskXp("urgent", -1)]).toEqual([5, 6, 12, 10]);
  });
  it("study points: nothing under 5 minutes, capped, with a bonus for long sessions", () => {
    expect(studyXp(4)).toBe(0);
    expect(studyXp(10)).toBe(2);
    expect(studyXp(45)).toBe(8 + 6);
    expect(studyXp(600)).toBe(16 + 6);
  });
  it("levels start as an egg and progress stays between 0 and 1", () => {
    expect(levelFor(0)).toMatchObject({ level: 0, legend: false });
    const l = levelFor(1e9);
    expect(l).toMatchObject({ legend: true, nextAt: null, progress: 1 });
  });
});

describe("crisis check (support chat safeguard)", () => {
  it.each(["I want to die", "i dont want to be here anymore", "thinking about suicide", "I might hurt myself", "self-harm again", "everyone is better off without me"])("flags: %s", (t) => {
    expect(isCrisis(t)).toBe(true);
  });
  it.each(["this bug is killing me", "I'm dying to try this", "deadline is tomorrow"])("does not flag everyday phrases: %s", (t) => {
    expect(isCrisis(t)).toBe(false);
  });
  // P2-18: more ways of saying it, in any case and inside a longer message
  it.each(["I KEEP THINKING ABOUT KILLING MYSELF", "honestly i wanna die", "I don't want to be alive", "there's no reason to live", "maybe I'd be better off dead", "I want to end my life", "I cut myself last night", "thoughts of selfharm"])("flags: %s", (t) => {
    expect(isCrisis(t)).toBe(true);
  });
  it("the safe reply (used when the AI can't answer) asks if she is safe and gives the lifeline", () => {
    expect(CRISIS_FALLBACK).toMatch(/safe right now/);
    expect(CRISIS_FALLBACK).toMatch(/1564/);
  });
});

describe("email HTML cleaning", () => {
  it("keeps formatting, drops scripts, event handlers and unsafe links", () => {
    const out = cleanHtml(`<p style="color:#f00" onmouseover="x()">Hi <b>you</b></p><script>bad()</script><a href="javascript:bad()">x</a><a href="https://ok.co">ok</a>`);
    expect(out).toContain(`<p style="color:#f00">Hi <b>you</b></p>`);
    expect(out).not.toMatch(/script|onmouseover|javascript/);
    expect(out).toContain(`<a href="https://ok.co" target="_blank" rel="noopener noreferrer">ok</a>`);
  });
  it("only allows our own attachment route for relative images", () => {
    expect(cleanHtml(`<img src="/api/emails/attachments/3">`)).toContain("/api/emails/attachments/3");
    expect(cleanHtml(`<img src="/etc/passwd">`)).toBe("");
  });
  it("turns HTML into readable plain text", () => {
    expect(textOf("<p>Line one</p><p>Line two</p><ul><li>a</li><li>b</li></ul>")).toBe("Line one\nLine two\na\nb");
  });
  // P2-16 fix: sanitize-html turns &nbsp; into the U+00A0 character before textOf's replace ran, so plain-text bodies
  // kept invisible no-break spaces. Now both are plain spaces.
  it("turns &nbsp; into a normal space", () => {
    expect(textOf("<p>a&nbsp;b</p>")).toBe("a b");
    expect(textOf("<p>a&nbsp;b</p>")).not.toContain(" ");
  });
});

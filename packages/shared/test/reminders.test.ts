import { describe, expect, it } from "vitest";
import { CreateReminderInput, UpdateReminderInput } from "../src/index.ts";

// The reminder rules the API used before P2-13 (cleanReminder in apps/api/src/index.ts), now as schemas.

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;
const AT = "2026-10-02T09:00";

describe("reminders", () => {
  it("create: trims and shortens the text, reads the time", () => {
    const r = CreateReminderInput.parse({ title: `  ${"x".repeat(130)} `, at: AT, repeat: "daily", note: "  n " });
    expect(r.title).toHaveLength(120);
    expect(r.at).toEqual(new Date(AT));
    expect(r).toMatchObject({ repeat: "daily", note: "n" });
  });
  it("create: needs a title and a valid time, and reports the first problem", () => {
    expect(firstError(CreateReminderInput.safeParse({ at: AT }))).toBe("Say what to remind you about.");
    expect(firstError(CreateReminderInput.safeParse({ title: "   ", at: AT }))).toBe("Say what to remind you about.");
    expect(firstError(CreateReminderInput.safeParse({ title: "x" }))).toBe("Pick a day and time.");
    expect(firstError(CreateReminderInput.safeParse({ title: "x", at: "not a time" }))).toBe("Pick a day and time.");
    expect(firstError(CreateReminderInput.safeParse({ title: "", at: "nope" }))).toBe("Say what to remind you about.");
  });
  it("create: only the known repeats", () => {
    expect(firstError(CreateReminderInput.safeParse({ title: "x", at: AT, repeat: "hourly" }))).toBe("That repeat isn't available.");
  });
  it("turns anything sent as text into text, like before", () => {
    expect(CreateReminderInput.parse({ title: 42, at: AT, note: 7 })).toMatchObject({ title: "42", note: "7" });
  });
  it("update: every field optional, but a field that is sent is checked", () => {
    expect(UpdateReminderInput.parse({})).toEqual({});
    expect(UpdateReminderInput.parse({ note: " later " })).toEqual({ note: "later" });
    expect(firstError(UpdateReminderInput.safeParse({ title: "" }))).toBe("Say what to remind you about.");
    expect(firstError(UpdateReminderInput.safeParse({ title: null }))).toBe("Say what to remind you about.");
    expect(firstError(UpdateReminderInput.safeParse({ at: "" }))).toBe("Pick a day and time.");
  });
});

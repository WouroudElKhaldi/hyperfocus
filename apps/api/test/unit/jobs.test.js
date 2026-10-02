import { describe, expect, it } from "vitest";
import { fields } from "../../src/modules/jobs/rules.ts";

// The job application field checks (P2-17), without a database.

describe("job fields", () => {
  it("a new job needs a company; texts are trimmed and cut to length", () => {
    expect(() => fields({ title: "Dev" }, false)).toThrow("Which company is it?");
    const f = fields({ company: " Acme ", notes: "n".repeat(6000), url: 5 }, false);
    expect(f).toMatchObject({ company: "Acme", url: "5" });
    expect(f.notes).toHaveLength(5000);
  });
  it("a change only touches what was sent, and can't empty the company", () => {
    expect(fields({ notes: "x" }, true)).toEqual({ notes: "x" });
    expect(() => fields({ company: "  " }, true)).toThrow("Which company is it?");
  });
  it("checks the status, follow-up day and applied date; empty clears the dates", () => {
    expect(() => fields({ status: "hired" }, true)).toThrow("Unknown status.");
    expect(() => fields({ followUpDay: "soon" }, true)).toThrow(/2026-10-31/);
    expect(() => fields({ appliedAt: "nope" }, true)).toThrow("That applied date isn't valid.");
    expect(fields({ status: "offer", followUpDay: "", appliedAt: "" }, true)).toEqual({ status: "offer", followUpDay: null, appliedAt: null });
    expect(fields({ appliedAt: "2026-10-01" }, true).appliedAt).toEqual(new Date("2026-10-01"));
  });
});

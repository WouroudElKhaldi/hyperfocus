import { describe, expect, it } from "vitest";
import { AddGoalActionsInput, CreateGoalInput, UpdateGoalInput } from "../src/index.ts";

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("goals", () => {
  it("create: needs the goal text; the date is optional, empty means none", () => {
    expect(firstError(CreateGoalInput.safeParse({ original: "  " }))).toBe("Write your goal first.");
    expect(CreateGoalInput.parse({ original: "x" }).targetDate).toBeUndefined();
    expect(CreateGoalInput.parse({ original: "x", targetDate: "" }).targetDate).toBeNull();
    expect(CreateGoalInput.parse({ original: "x", targetDate: "2026-12-31" }).targetDate).toEqual(new Date("2026-12-31"));
    expect(firstError(CreateGoalInput.safeParse({ original: "x", targetDate: "nope" }))).toBe("Invalid date.");
  });
  it("update: only what is sent; an empty date clears it", () => {
    expect(UpdateGoalInput.parse({})).toEqual({});
    expect(UpdateGoalInput.parse({ targetDate: null })).toEqual({ targetDate: null });
    expect(firstError(UpdateGoalInput.safeParse({ targetDate: "bad" }))).toBe("Invalid date.");
  });
  it("actions: several or one", () => {
    expect(AddGoalActionsInput.parse({ texts: ["a", "b"] })).toEqual({ texts: ["a", "b"] });
    expect(AddGoalActionsInput.parse({ text: "a" })).toEqual({ text: "a" });
  });
});

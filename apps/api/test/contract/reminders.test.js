import { describe, expect, it } from "vitest";
import { del, get, ok, patch, post } from "../support/api.js";

const later = (h) => new Date(Date.now() + h * 3600000).toISOString();

describe("my reminders", () => {
  it("creates a reminder", async () => {
    const r = await ok(post("/api/reminders", { title: " Call mum ", at: later(2), repeat: "daily", note: "n" }));
    expect(r).toMatchObject({ title: "Call mum", repeat: "daily", note: "n", done: false });
  });

  it("validates title, time and repeat", async () => {
    const e = async (b) => (await post("/api/reminders", b)).body.error;
    expect(await e({ at: later(1) })).toBe("Say what to remind you about.");
    expect(await e({ title: "x" })).toBe("Pick a day and time.");
    expect(await e({ title: "x", at: "nope" })).toBe("Pick a day and time.");
    expect(await e({ title: "x", at: later(1), repeat: "hourly" })).toBe("That repeat isn't available.");
  });

  it("moving a reminder into the future re-arms it", async () => {
    const r = await ok(post("/api/reminders", { title: "x", at: later(1) }));
    const u = await ok(patch(`/api/reminders/${r.id}`, { at: later(5) }));
    expect(u.done).toBe(false);
    expect((await patch(`/api/reminders/${r.id}`, { title: "" })).status).toBe(400);
  });

  it("lists open reminders soonest first and deletes (deleting twice is fine)", async () => {
    const a = await ok(post("/api/reminders", { title: "later", at: later(10) }));
    const b = await ok(post("/api/reminders", { title: "sooner", at: later(1) }));
    const list = await ok(get("/api/reminders"));
    expect(list.findIndex((x) => x.id === b.id)).toBeLessThan(list.findIndex((x) => x.id === a.id));
    expect(await ok(del(`/api/reminders/${a.id}`))).toEqual({ ok: true });
    expect(await ok(del(`/api/reminders/${a.id}`))).toEqual({ ok: true });
  });

  // P2-13: changing a reminder that doesn't exist is "not found" (it used to be a 500)
  it("answers 404 when changing a reminder that doesn't exist", async () => {
    const r = await patch("/api/reminders/999999", { note: "x" });
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("Reminder not found.");
  });
});

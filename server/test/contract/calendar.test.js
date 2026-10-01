import { describe, expect, it } from "vitest";
import { api, day, del, get, ok, patch, post } from "../support/api.js";

describe("calendar events", () => {
  it("creates a timed event and an all-day event", async () => {
    const e = await ok(post("/api/events", { title: "Exam", day: day(3), startTime: "10:00", endTime: "12:00", category: "study", location: "Hall A" }));
    expect(e).toMatchObject({ title: "Exam", day: day(3), allDay: false, startTime: "10:00", endTime: "12:00", category: "study", location: "Hall A" });
    // no start time means all day
    expect((await ok(post("/api/events", { title: "Holiday", day: day(4) }))).allDay).toBe(true);
  });

  it("validates events", async () => {
    const e = async (b) => (await post("/api/events", b)).body.error;
    expect(await e({ day: day() })).toBe("Give the event a title.");
    expect(await e({ title: "x", day: "tomorrow" })).toBe("Pick a valid date.");
    expect(await e({ title: "x", day: day(), startTime: "25:00" })).toBe("Times look like 14:30.");
    expect(await e({ title: "x", day: day(), startTime: "12:00", endTime: "11:00" })).toBe("The end must be after the start.");
    expect(await e({ title: "x", day: day(), repeat: "weekly", repeatUntil: "soon" })).toBe("Pick a valid end date for the repeat.");
  });

  it("normalises unknown category/repeat and out-of-range reminders", async () => {
    const e = await ok(post("/api/events", { title: "x", day: day(), category: "party", repeat: "hourly", remindMin: 999999 }));
    expect(e).toMatchObject({ category: "event", repeat: "none", remindMin: -1 });
  });

  it("updates an event, checking the end stays after the start", async () => {
    const e = await ok(post("/api/events", { title: "Meet", day: day(1), startTime: "09:00", endTime: "10:00" }));
    expect((await ok(patch(`/api/events/${e.id}`, { title: "Meet 2", endTime: "11:00" }))).endTime).toBe("11:00");
    expect((await patch(`/api/events/${e.id}`, { startTime: "12:00" })).status).toBe(400);
    expect((await patch("/api/events/999999", { title: "x" })).status).toBe(404);
  });

  it("repeats weekly, and skipping one day removes only that occurrence", async () => {
    const start = day(0);
    const e = await ok(post("/api/events", { title: "Weekly class", day: start, startTime: "08:00", endTime: "09:00", repeat: "weekly" }));
    const range = async () => (await ok(get(`/api/calendar?from=${start}&to=${day(20)}`))).events.filter((o) => o.id === e.id || o.eventId === e.id);
    expect(await range()).toHaveLength(3);
    const skipped = await ok(post(`/api/events/${e.id}/skip`, { day: day(7) }));
    expect(skipped.exceptions).toBe(day(7));
    expect(await range()).toHaveLength(2);
    expect((await post(`/api/events/${e.id}/skip`, { day: "x" })).status).toBe(400);
    expect((await post("/api/events/999999/skip", { day: day() })).status).toBe(404);
  });

  it("lists and deletes events", async () => {
    const e = await ok(post("/api/events", { title: "bye", day: day() }));
    expect((await ok(get("/api/events"))).some((x) => x.id === e.id)).toBe(true);
    await ok(del(`/api/events/${e.id}`));
    expect((await ok(get("/api/events"))).some((x) => x.id === e.id)).toBe(false);
  });
});

describe("calendar views", () => {
  it("returns everything for a range: events, tasks, goals, study and posts", async () => {
    await ok(post("/api/tasks", { title: "due task", dueDay: day(2) }));
    const c = await ok(get(`/api/calendar?from=${day()}&to=${day(7)}`));
    expect(Object.keys(c).sort()).toEqual(["events", "from", "goals", "posts", "study", "tasks", "to"]);
    expect(c.tasks.some((t) => t.title === "due task" && t.day === day(2))).toBe(true);
  });

  it("validates the range", async () => {
    expect((await get("/api/calendar")).status).toBe(400);
    expect((await get(`/api/calendar?from=${day(5)}&to=${day()}`)).status).toBe(400);
    expect((await get(`/api/calendar?from=${day()}&to=${day(150)}`)).body.error).toBe("That range is too long.");
  });

  it("exports an .ics file", async () => {
    const r = await api("GET", "/api/calendar.ics");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/calendar/);
    expect(r.body).toMatch(/^BEGIN:VCALENDAR/);
    expect(r.body).toMatch(/END:VCALENDAR\s*$/);
  });

  it("parses a sentence into an event with the AI", async () => {
    expect((await post("/api/calendar/parse", { text: "" })).status).toBe(400);
    const e = await ok(post("/api/calendar/parse", { text: "study Friday 3pm for 1h" }));
    expect(e).toMatchObject({ title: "Study", allDay: false, startTime: "15:00", endTime: "16:00", category: "study", repeat: "none" });
  });

  it("plans study blocks", async () => {
    const r = await ok(post("/api/calendar/plan"));
    expect(r).toMatchObject({ blocks: expect.any(Array) });
  });
});

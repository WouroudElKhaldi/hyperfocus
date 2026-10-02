import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { CalendarEvent, CalendarRange, CalendarRangeQuery, EventFields, ParseEventInput, ParsedEvent, SkipDayInput, StudyPlan } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, Ok, body, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError, orNull } from "../../types.ts";
import { DAY_RE, buildCalendar, buildIcs, parseEventText, planStudyBlocks, toMin } from "./calendar.ts";
import { cleanEvent } from "./event-rules.ts";

// The calendar (P2-12): events (with repeats and skipped days), everything shown for a date range, the .ics export,
// AI quick add and "plan my study week". Same answers as the Express routes had, plus the P2 fix: deleting an event
// that doesn't exist is a 404 "Event not found." (it was a 500).

const EVENT_404 = "Event not found.";

export function calendarRouter({ prisma, ai }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const tags = ["Calendar"];
  const idOf = (raw: string | undefined) => pathId(raw, EVENT_404);

  // ---------- events ----------
  app.openapi(
    createRoute({ method: "get", path: "/api/events", tags, summary: "Every event (a repeating one is one row)", responses: { 200: json(z.array(CalendarEvent), "The events") } }),
    async (c) => c.json(await prisma.event.findMany({ orderBy: [{ day: "asc" }, { startTime: "asc" }] }), 200),
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/events", tags, summary: "Add an event", request: { body: body(EventFields) }, responses: { 200: json(CalendarEvent, "The new event"), 400: problem("Something to fix") } }),
    async (c) => {
      const checked = cleanEvent(c.req.valid("json"));
      if (checked.error !== undefined) throw httpError(400, checked.error);
      return c.json(await prisma.event.create({ data: checked.data }), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/events/{id}", tags, summary: "Change an event (only the fields sent change)",
      request: { params: IdParam, body: body(EventFields) }, responses: { 200: json(CalendarEvent, "The event after the change"), 400: problem("Something to fix"), 404: problem("No such event") },
    }),
    async (c) => {
      const checked = cleanEvent(c.req.valid("json"), true);
      if (checked.error !== undefined) throw httpError(400, checked.error);
      const cur = await prisma.event.findUnique({ where: { id: idOf(c.req.param("id")) } });
      if (!cur) throw httpError(404, EVENT_404);
      // the end must stay after the start, also when only one of them changes
      const st = checked.data.startTime ?? cur.startTime, en = checked.data.endTime ?? cur.endTime;
      if (!checked.data.allDay && st && en && toMin(en) <= toMin(st)) throw httpError(400, "The end must be after the start.");
      return c.json(await prisma.event.update({ where: { id: cur.id }, data: checked.data }), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/events/{id}/skip", tags, summary: "Leave one day out of a repeating event",
      request: { params: IdParam, body: body(SkipDayInput) }, responses: { 200: json(CalendarEvent, "The event"), 400: problem("Not a date"), 404: problem("No such event") },
    }),
    async (c) => {
      const cur = await prisma.event.findUnique({ where: { id: idOf(c.req.param("id")) } });
      if (!cur) throw httpError(404, EVENT_404);
      const days = new Set((cur.exceptions || "").split(",").filter(Boolean));
      days.add(c.req.valid("json").day);
      return c.json(await prisma.event.update({ where: { id: cur.id }, data: { exceptions: [...days].sort().join(",") } }), 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/events/{id}", tags, summary: "Delete an event (the whole series)", request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: problem("No such event") } }),
    async (c) => {
      if (!(await orNull(prisma.event.delete({ where: { id: idOf(c.req.param("id")) } })))) throw httpError(404, EVENT_404);
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------- views ----------
  app.openapi(
    createRoute({
      method: "get", path: "/api/calendar", tags, summary: "Everything for a date range (at most 100 days): events, tasks, goals, study, posts",
      request: { query: CalendarRangeQuery }, responses: { 200: json(CalendarRange, "The range"), 400: problem("Not a valid range") },
    }),
    async (c) => {
      const { from = "", to = "" } = c.req.valid("query");
      if (!DAY_RE.test(from) || !DAY_RE.test(to) || to < from) throw httpError(400, "Give a valid from and to date.");
      if ((new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 100) throw httpError(400, "That range is too long.");
      return c.json(await buildCalendar(prisma, from, to), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get", path: "/api/calendar.ics", tags, summary: "Everything as an .ics file (Google, Apple, Outlook calendars)",
      responses: { 200: { description: "The calendar file", content: { "text/calendar": { schema: z.string() } } } },
    }),
    async (c) =>
      c.body(await buildIcs(prisma), 200, { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="thought-studio.ics"' }),
  );

  // ---------- AI ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/calendar/parse", tags, summary: "AI: turn a sentence into an event (not saved)",
      request: { body: body(ParseEventInput) }, responses: { 200: json(ParsedEvent, "The event to confirm"), 400: problem("Nothing typed") },
    }),
    async (c) => c.json(await parseEventText(ai, c.req.valid("json").text.slice(0, 300)), 200),
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/calendar/plan", tags, summary: "AI: study blocks for the next 7 days, only inside free time", responses: { 200: json(StudyPlan, "Proposed blocks (not saved)") } }),
    async (c) => c.json(await planStudyBlocks(ai, prisma), 200),
  );

  return app;
}

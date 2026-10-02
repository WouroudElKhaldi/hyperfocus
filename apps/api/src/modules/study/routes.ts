import { createRoute } from "@hono/zod-openapi";
import type { StudySession as Row } from "@hyperfocus/db";
import { CreateStudyInput, StudySession, UpdateStudyInput } from "@hyperfocus/shared";
import type { AppDeps } from "../../app.ts";
import { IdParam, crudRouter, json, pathId, problem } from "../../http/crud.ts";
import { activeMs, compact, httpError } from "../../types.ts";
import { type Transition, checkEdit, checkLogged, pause, reopen, resume, stop } from "./session.ts";

// The study log and its timer (P2-10). The rules live in session.ts (a tested state machine); these routes load the
// session, apply a rule and save what it says. Same answers as the Express routes had, plus the P2 fix: editing or
// deleting a session that doesn't exist is a 404 "Session not found." (it was a 500).

const NOT_FOUND = "Session not found.";

export function studyRouter({ prisma, events }: AppDeps) {
  const runningOne = () => prisma.studySession.findFirst({ where: { endedAt: null } });

  const app = crudRouter({
    path: "/api/study",
    tag: "Study",
    name: "study session",
    item: StudySession,
    create: CreateStudyInput,
    update: UpdateStudyInput,
    notFound: NOT_FOUND,
    store: {
      list: () => prisma.studySession.findMany({ orderBy: { startedAt: "desc" } }),
      // no times = start the timer now; times = log a past session (with the minutes of break it had)
      create: async ({ course, part, notes, startedAt = new Date(), endedAt = null, breakMins = 0 }) => {
        const breakMs = breakMins * 60000;
        if (!endedAt && (await runningOne())) throw httpError(409, "A session is already running. Stop it first.");
        const problem = checkLogged(startedAt, endedAt, breakMs); // (only a logged session, with an end, can have a problem)
        if (problem) throw httpError(400, problem);
        return prisma.studySession.create({ data: { course, part, notes, startedAt, endedAt, breakMs } });
      },
      update: async (id, { startedAt, endedAt, breakMins, ...text }) => {
        const cur = await prisma.studySession.findUnique({ where: { id } });
        if (!cur) return null;
        const breakMs = breakMins === undefined ? undefined : breakMins * 60000;
        const problem = checkEdit(cur, compact({ startedAt, endedAt, breakMs }));
        if (problem) throw httpError(400, problem);
        return prisma.studySession.update({ where: { id }, data: { ...compact(text), ...compact({ startedAt, endedAt, breakMs }) } });
      },
      remove: async (id) => (await prisma.studySession.deleteMany({ where: { id } })).count > 0,
    },
  });

  // Applies a timer rule to one session: saves the change, returns the session as it is when there is nothing to do,
  // or refuses with a 409.
  const apply = async (cur: Row, t: Transition): Promise<Row> => {
    if ("refuse" in t) throw httpError(409, t.refuse);
    if ("nothing" in t) return cur;
    return prisma.studySession.update({ where: { id: cur.id }, data: t.change });
  };
  const find = (raw: string | undefined) => prisma.studySession.findUnique({ where: { id: pathId(raw, NOT_FOUND) } });
  const timerRoute = (action: string, summary: string) =>
    createRoute({ method: "post", path: `/api/study/{id}/${action}`, tags: ["Study"], summary, request: { params: IdParam }, responses: { 200: json(StudySession, "The session"), 404: problem("No such session"), 409: problem("Not possible right now") } });

  app.openapi(timerRoute("pause", "Take a break (the timer stops counting)"), async (c) => {
    const cur = await find(c.req.param("id"));
    if (!cur) throw httpError(409, "This session isn't running."); // as before: a missing session simply isn't running
    return c.json(await apply(cur, pause(cur, new Date())), 200);
  });
  app.openapi(timerRoute("resume", "End the break (it is added to the break time)"), async (c) => {
    const cur = await find(c.req.param("id"));
    if (!cur) throw httpError(409, "This session isn't running.");
    return c.json(await apply(cur, resume(cur, new Date())), 200);
  });
  app.openapi(timerRoute("stop", "Stop and save the session"), async (c) => {
    const cur = await find(c.req.param("id"));
    if (!cur) throw httpError(404, NOT_FOUND);
    const stopped = await apply(cur, stop(cur, new Date()));
    if (!cur.endedAt) await events.publish("StudySessionEnded", { sessionId: stopped.id, activeMinutes: Math.round(activeMs(stopped) / 60000), course: stopped.course });
    return c.json(stopped, 200);
  });
  app.openapi(timerRoute("continue", "Undo an accidental stop (within 6 hours; the time away counts as a break)"), async (c) => {
    const cur = await find(c.req.param("id"));
    if (!cur) throw httpError(404, NOT_FOUND);
    const another = cur.endedAt ? !!(await runningOne()) : false;
    return c.json(await apply(cur, reopen(cur, new Date(), another)), 200);
  });

  return app;
}

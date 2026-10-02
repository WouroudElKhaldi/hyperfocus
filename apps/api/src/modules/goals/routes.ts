import { createRoute } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import type { Prisma } from "@hyperfocus/db";
import {
  AddGoalActionsInput, AddGoalLogInput, CreateGoalInput, Goal, GoalAction, GoalAnalysis, UpdateGoalActionInput, UpdateGoalInput,
} from "@hyperfocus/shared";
import type { AppDeps } from "../../app.ts";
import { IdParam, Ok, body, crudRouter, json, pathId, problem } from "../../http/crud.ts";
import { activeMs, compact, httpError, orNull } from "../../types.ts";

// Goals with their actions (the plan) and logs (progress) (P2-08). Same answers as the Express routes had, plus the P2
// fix: a goal, action or log entry that doesn't exist is a 404 (it used to be a 500, or a `null` body).

const goalInclude = { actions: { orderBy: { id: "asc" } }, logs: { orderBy: { createdAt: "desc" } } } satisfies Prisma.GoalInclude;
const GOAL_404 = "Goal not found.";

export function goalsRouter({ prisma, events, ai }: AppDeps) {
  const app = crudRouter({
    path: "/api/goals",
    tag: "Goals",
    name: "goal",
    item: Goal,
    create: CreateGoalInput,
    update: UpdateGoalInput,
    notFound: GOAL_404,
    store: {
      list: () => prisma.goal.findMany({ include: goalInclude, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
      create: ({ original, targetDate }) => prisma.goal.create({ data: { original, targetDate: targetDate ?? null }, include: goalInclude }),
      update: async (id, data) => {
        const goal = await orNull(prisma.goal.update({ where: { id }, data: compact(data), include: goalInclude }));
        if (goal && data.status === "achieved") await events.publish("GoalAchieved", { goalId: goal.id, text: goal.refined || goal.original });
        return goal;
      },
      remove: async (id) => (await prisma.goal.deleteMany({ where: { id } })).count > 0, // actions and logs go with it
    },
  });

  // the goal with its plan and progress, or a 404
  const goalOr404 = async (id: number) => {
    const goal = await prisma.goal.findUnique({ where: { id }, include: goalInclude });
    if (!goal) throw httpError(404, GOAL_404);
    return goal;
  };

  // ---------- the AI's honest read ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/goals/{id}/analyze", tags: ["Goals"], summary: "Ask the AI: sharper wording, is it realistic by the date, suggested steps",
      request: { params: IdParam }, responses: { 200: json(GoalAnalysis, "The goal with the verdict saved, and suggested steps (not saved)"), 404: problem("No such goal") },
    }),
    async (c) => {
      const goal = await prisma.goal.findUnique({ where: { id: pathId(c.req.param("id"), GOAL_404) }, include: { actions: true } });
      if (!goal) throw httpError(404, GOAL_404);
      const since = new Date(Date.now() - 14 * 86400000);
      const sessions = await prisma.studySession.findMany({ where: { endedAt: { not: null }, startedAt: { gte: since } } });
      const mins = sessions.reduce((a, s) => a + activeMs(s) / 60000, 0);
      const out = await ai.run(prompts.analyzeGoal, {
        goal: goal.original,
        targetDate: goal.targetDate?.toISOString().slice(0, 10),
        today: new Date().toISOString().slice(0, 10),
        studyHours14d: (mins / 60).toFixed(1),
        existingActions: goal.actions.map((a) => a.text),
      });
      const saved = await prisma.goal.update({
        where: { id: goal.id },
        data: { refined: out.refined, verdict: out.verdict, verdictNote: out.verdictNote, suggestion: out.suggestion, analyzedAt: new Date() },
        include: goalInclude,
      });
      return c.json({ goal: saved, actions: out.actions }, 200);
    },
  );

  // ---------- actions (the plan) ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/goals/{id}/actions", tags: ["Goals"], summary: "Add steps to the plan (several, or one); blank ones are skipped",
      request: { params: IdParam, body: body(AddGoalActionsInput) }, responses: { 200: json(Goal, "The goal with its plan"), 404: problem("No such goal") },
    }),
    async (c) => {
      const goalId = pathId(c.req.param("id"), GOAL_404);
      await goalOr404(goalId);
      const { texts, text } = c.req.valid("json");
      const kept = (texts ?? [text]).filter((t): t is string => !!t?.trim());
      await prisma.goalAction.createMany({ data: kept.map((t) => ({ text: t, goalId })) });
      return c.json(await goalOr404(goalId), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/goal-actions/{id}", tags: ["Goals"], summary: "Tick or reword a step of the plan",
      request: { params: IdParam, body: body(UpdateGoalActionInput) }, responses: { 200: json(GoalAction, "The step"), 404: problem("No such step") },
    }),
    async (c) => {
      const input = c.req.valid("json");
      const step = await orNull(prisma.goalAction.update({ where: { id: pathId(c.req.param("id"), "Goal step not found.") }, data: compact(input) }));
      if (!step) throw httpError(404, "Goal step not found.");
      if (input.done === true) await events.publish("GoalStepDone", { stepId: step.id, text: step.text });
      return c.json(step, 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/goal-actions/{id}", tags: ["Goals"], summary: "Delete a step of the plan", request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: problem("No such step") } }),
    async (c) => {
      if (!(await prisma.goalAction.deleteMany({ where: { id: pathId(c.req.param("id"), "Goal step not found.") } })).count) throw httpError(404, "Goal step not found.");
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------- logs (progress) ----------
  app.openapi(
    createRoute({
      method: "post", path: "/api/goals/{id}/logs", tags: ["Goals"], summary: "Write down what you did toward the goal",
      request: { params: IdParam, body: body(AddGoalLogInput) }, responses: { 200: json(Goal, "The goal with its progress"), 400: problem("Empty"), 404: problem("No such goal") },
    }),
    async (c) => {
      const goalId = pathId(c.req.param("id"), GOAL_404);
      await goalOr404(goalId);
      await prisma.goalLog.create({ data: { text: c.req.valid("json").text, goalId } });
      return c.json(await goalOr404(goalId), 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/goal-logs/{id}", tags: ["Goals"], summary: "Delete a progress entry", request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: problem("No such entry") } }),
    async (c) => {
      if (!(await prisma.goalLog.deleteMany({ where: { id: pathId(c.req.param("id"), "Progress entry not found.") } })).count) throw httpError(404, "Progress entry not found.");
      return c.json({ ok: true as const }, 200);
    },
  );

  return app;
}

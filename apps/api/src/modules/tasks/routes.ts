import { createRoute, z } from "@hono/zod-openapi";
import { AddStepsInput, CreateTaskInput, Step, Task, UpdateStepInput, UpdateTaskInput } from "@hyperfocus/shared";
import type { Prisma } from "@hyperfocus/db";
import type { AppDeps } from "../../app.ts";
import { crudRouter, parseId } from "../../http/crud.ts";
import { compact, httpError, orNull } from "../../types.ts";

// Tasks and their tiny steps (P2-07). Same answers as the Express routes had, plus the P2 fix: a task or step that
// doesn't exist is a 404 ("Task not found." / "Step not found.") instead of a 500 or a `null` body.

const taskInclude = { steps: { orderBy: { id: "asc" } } } satisfies Prisma.TaskInclude;
const Ok = z.object({ ok: z.literal(true) });
const IdParam = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, example: "12" }) });
const json = (schema: z.ZodType, description: string) => ({ description, content: { "application/json": { schema } } });
const notFound = (description: string) => ({ description, content: { "application/problem+json": { schema: z.object({ status: z.number(), error: z.string() }) } } });

export function tasksRouter({ prisma, events }: AppDeps) {
  const app = crudRouter({
    path: "/api/tasks",
    tag: "Tasks",
    name: "task",
    item: Task,
    create: CreateTaskInput,
    update: UpdateTaskInput,
    notFound: "Task not found.",
    store: {
      // open tasks first, newest first
      list: () => prisma.task.findMany({ include: taskInclude, orderBy: [{ done: "asc" }, { createdAt: "desc" }] }),
      create: async ({ title, today, dueDay, priority }) => {
        const task = await prisma.task.create({ data: { title, today: !!today, dueDay: dueDay || null, priority }, include: taskInclude });
        await events.publish("TaskCaptured", { taskId: task.id });
        return task;
      },
      update: async (id, { done, dueDay, ...rest }) => {
        const data: Prisma.TaskUncheckedUpdateInput = compact(rest);
        if (dueDay !== undefined) data.dueDay = dueDay || null; // sending dueDay "" or null clears it
        if (done !== undefined) {
          data.done = done;
          data.doneAt = done ? new Date() : null;
        }
        const task = await orNull(prisma.task.update({ where: { id }, data, include: taskInclude }));
        if (task && done === true) await events.publish("TaskCompleted", { taskId: task.id, title: task.title, priority: task.priority });
        return task;
      },
      remove: async (id) => (await prisma.task.deleteMany({ where: { id } })).count > 0, // its steps go with it (cascade)
    },
  });

  const idOr404 = (raw: string | undefined, message: string) => {
    const id = parseId(raw ?? "");
    if (id === null) throw httpError(404, message);
    return id;
  };

  // ---------- steps ----------
  const addSteps = createRoute({
    method: "post", path: "/api/tasks/{id}/steps", tags: ["Tasks"], summary: "Add tiny steps to a task (several at once, or one)",
    request: { params: IdParam, body: { content: { "application/json": { schema: AddStepsInput } }, required: true } },
    responses: { 200: json(Task, "The task with all its steps"), 404: notFound("No such task") },
  });
  app.openapi(addSteps, async (c) => {
    const taskId = idOr404(c.req.param("id"), "Task not found.");
    if (!(await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } }))) throw httpError(404, "Task not found.");
    const body = c.req.valid("json");
    const texts = "steps" in body ? body.steps : [body.text];
    await prisma.step.createMany({ data: texts.filter(Boolean).map((text) => ({ text, taskId })) }); // empty ones are skipped
    return c.json(await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude }), 200);
  });

  const tickStep = createRoute({
    method: "patch", path: "/api/steps/{id}", tags: ["Tasks"], summary: "Tick or untick a step",
    request: { params: IdParam, body: { content: { "application/json": { schema: UpdateStepInput } }, required: true } },
    responses: { 200: json(Step, "The step"), 404: notFound("No such step") },
  });
  app.openapi(tickStep, async (c) => {
    const step = await orNull(prisma.step.update({ where: { id: idOr404(c.req.param("id"), "Step not found.") }, data: compact(c.req.valid("json")) }));
    if (!step) throw httpError(404, "Step not found.");
    return c.json(step, 200);
  });

  const deleteStep = createRoute({
    method: "delete", path: "/api/steps/{id}", tags: ["Tasks"], summary: "Delete a step",
    request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: notFound("No such step") },
  });
  app.openapi(deleteStep, async (c) => {
    const { count } = await prisma.step.deleteMany({ where: { id: idOr404(c.req.param("id"), "Step not found.") } });
    if (!count) throw httpError(404, "Step not found.");
    return c.json({ ok: true as const }, 200);
  });

  return app;
}

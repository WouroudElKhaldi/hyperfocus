import { CreateTaskInput } from "@hyperfocus/shared";
import { MAX_STEP_POINTS, STEP_POINT, TASK_PRIORITIES, TASK_PRIORITY_POINTS } from "@hyperfocus/shared/constants";
import { oneOf } from "../../../api.ts";
import { useToast } from "../../../App.tsx";
import More from "../../../components/More.tsx";
import { showServerError, useSchemaForm } from "../../../components/form.tsx";
import type { Task } from "../../../types.ts";
import {
  useAddTask,
  useBreakDown,
  useDeleteSteps,
  useDeleteTask,
  useTasks,
  useUpdateStep,
  useUpdateTask,
} from "../api.ts";

// More important tasks earn more points for your companion. The list and the points come from @hyperfocus/shared,
// the same values the API awards, so what you see is what you get. Only the labels live here.
const PRIORITY_LABELS: Record<string, string> = { low: "Low", normal: "Normal", high: "Important", urgent: "Critical" };
const PRIORITIES = TASK_PRIORITIES.map((id) => ({ id, label: PRIORITY_LABELS[id], pts: TASK_PRIORITY_POINTS[id] }));
const RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function Tasks() {
  const toast = useToast();
  const tasks = useTasks().data ?? [];
  // checked by the API's own schema: an empty title gets the server's message before anything is sent
  const form = useSchemaForm(CreateTaskInput, { defaultValues: { title: "", priority: "normal" } });
  const addTask = useAddTask();
  const update = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateStep = useUpdateStep();
  const deleteSteps = useDeleteSteps();
  const breakDown = useBreakDown();
  const busyId = breakDown.isPending ? breakDown.variables.id : null;
  const formError = form.formState.errors.title?.message ?? form.formState.errors.root?.["server"]?.message;

  const add = form.handleSubmit(async (task) => {
    try {
      await addTask.mutateAsync({ title: task.title, priority: task.priority });
      form.reset({ title: "", priority: task.priority });
    } catch (e) {
      showServerError(form, e);
    }
  });
  const change = (t: Task, change: Parameters<typeof update.mutate>[0]["change"]) =>
    update.mutate({ id: t.id, change });
  const setToday = (t: Task) => {
    const count = tasks.filter((x) => x.today && !x.done).length;
    if (!t.today && count >= 3) return toast("3 is plenty for today. Finish one first 💜", "err");
    change(t, { today: !t.today });
  };

  // the most important things first
  const open = tasks.filter((t) => !t.done).sort((a, b) => (RANK[a.priority] ?? 2) - (RANK[b.priority] ?? 2)); // priorities are always known; 2 = normal
  const done = tasks.filter((t) => t.done);
  // its importance, plus 1 for each of its steps done (up to 6): what the API awards (P3-24)
  const pts = (t: Task) => (PRIORITIES.find((p) => p.id === t.priority)?.pts ?? 3) + Math.min(MAX_STEP_POINTS, (t.steps ?? []).filter((s) => s.done).length * STEP_POINT);

  const row = (t: Task) => (
    <div className="item" key={t.id}>
      <input
        type="checkbox"
        className="check"
        checked={t.done}
        onChange={() => change(t, { done: !t.done })}
        aria-label={`Done: ${t.title}`}
      />
      <div className="grow">
        <div className="row" style={{ gap: "var(--s-2)", flexWrap: "nowrap" }}>
          <span className={"grow" + (t.done ? " done" : "")}>{t.title}</span>
          <span className={"prio p-" + t.priority} title="Points for your companion when you finish it: its importance, plus 1 for each step done">
            +{pts(t)}
          </span>
        </div>
        {t.steps.length > 0 && (
          <div className="steps">
            {t.steps.map((s) => (
              <div key={s.id} className="step-row">
                <label className={s.done ? "done" : ""}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => updateStep.mutate({ id: s.id, change: { done: !s.done } })}
                  />{" "}
                  {s.text}
                </label>
                <button
                  className="ghost icon-btn"
                  onClick={() => deleteSteps.mutate([s.id])}
                  aria-label={`Remove step: ${s.text}`}
                  title="Remove this step"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {!t.done && (
          <div className="row" style={{ marginTop: "var(--s-2)" }}>
            <button className="ghost" onClick={() => setToday(t)}>
              {t.today ? "In today ✓" : "Add to today"}
            </button>
            {t.steps.length === 0 && (
              <button
                className="ghost"
                disabled={busyId === t.id}
                onClick={() => breakDown.mutate({ id: t.id, title: t.title })}
              >
                {busyId === t.id ? "Thinking…" : "Tiny steps (AI)"}
              </button>
            )}
            <More label="Options" className="inline">
              <select
                className="mini-select"
                value={t.priority}
                onChange={(e) => change(t, { priority: oneOf(TASK_PRIORITIES, e.target.value, "normal") })}
                aria-label="How important"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} (+{p.pts})
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="mini-date"
                title="Due date (shows on the calendar)"
                value={t.dueDay || ""}
                onChange={(e) => change(t, { dueDay: e.target.value || null })}
              />
              {t.steps.length > 0 && (
                <button className="ghost" onClick={() => deleteSteps.mutate(t.steps.map((s) => s.id))}>
                  Remove all tiny steps
                </button>
              )}
              <button className="ghost danger" onClick={() => deleteTask.mutate(t.id)}>
                Delete task
              </button>
            </More>
          </div>
        )}
        {t.done && (
          <div className="row" style={{ marginTop: "var(--s-1)" }}>
            <button className="ghost danger" onClick={() => deleteTask.mutate(t.id)}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <h1>Tasks</h1>
      <p className="sub">Add a task, then tick it off. Stuck on one? Try "Tiny steps".</p>
      <form className="card row" onSubmit={add} noValidate>
        <input
          className="grow"
          placeholder="New task…"
          aria-label="New task"
          aria-invalid={!!formError}
          {...form.register("title")}
        />
        <button className="primary" disabled={addTask.isPending}>
          Add
        </button>
        <More label="How important?" className="inline">
          <select aria-label="How important" {...form.register("priority")}>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (+{p.pts})
              </option>
            ))}
          </select>
        </More>
        {formError && (
          <p role="alert" className="m-0 w-full text-sm text-destructive">
            {formError}
          </p>
        )}
      </form>
      <div className="card">
        {open.length === 0 && <div className="empty">All clear. Nothing waiting.</div>}
        {open.map(row)}
      </div>
      {done.length > 0 && (
        <div className="card">
          <h2>Done ({done.length})</h2>
          {done.map(row)}
        </div>
      )}
    </>
  );
}

import { describe, expect, it } from "vitest";
import { TASK_PRIORITIES, TASK_PRIORITY_POINTS } from "../src/constants.ts";
import { AddStepsInput, CreateNoteInput, CreateTaskInput, Note, NoteListItem, Task, UpdateNoteInput, UpdateTaskInput } from "../src/index.ts";

// Each rule here mirrors what the API does today (see apps/api/test/contract/notes.test.js and tasks.test.js),
// with the same error messages, so P2 can switch the API to these schemas without changing its behaviour.

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("notes", () => {
  it("create: defaults kind and title, keeps the body as typed", () => {
    expect(CreateNoteInput.parse({ body: "  hi " })).toEqual({ kind: "thought", title: "", body: "  hi " });
  });
  it("create: refuses a blank or missing body with the API's message", () => {
    expect(firstError(CreateNoteInput.safeParse({ body: "   " }))).toBe("Write something first.");
    expect(firstError(CreateNoteInput.safeParse({}))).toBe("Write something first.");
  });
  it("create: accepts any kind, like the API does today", () => {
    expect(CreateNoteInput.parse({ body: "x", kind: "whatever" }).kind).toBe("whatever");
  });
  it("update: every field optional, unknown fields dropped", () => {
    expect(UpdateNoteInput.parse({ pinned: true, hack: 1 })).toEqual({ pinned: true });
  });
  it("list item: a note plus its post ids and posted flag", () => {
    const note = { id: 1, kind: "note", title: "", body: "b", pinned: false, archived: false, createdAt: "2026-10-02T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z" };
    expect(Note.parse(note)).toEqual(note);
    expect(NoteListItem.safeParse({ ...note, postIds: [2], posted: true }).success).toBe(true);
    expect(NoteListItem.safeParse(note).success).toBe(false);
  });
});

describe("tasks", () => {
  it("create: a missing or unknown priority becomes normal", () => {
    expect(CreateTaskInput.parse({ title: "a" }).priority).toBe("normal");
    expect(CreateTaskInput.parse({ title: "a", priority: "whenever" }).priority).toBe("normal");
    expect(CreateTaskInput.parse({ title: "a", priority: "urgent" }).priority).toBe("urgent");
  });
  it("create: refuses a blank title with the API's message", () => {
    expect(firstError(CreateTaskInput.safeParse({ title: " " }))).toBe("Task needs a title.");
  });
  it("update: an unknown priority is refused with the API's message", () => {
    expect(firstError(UpdateTaskInput.safeParse({ priority: "mega" }))).toBe("Importance must be low, normal, high or urgent.");
    expect(UpdateTaskInput.parse({ done: true, dueDay: null })).toEqual({ done: true, dueDay: null });
  });
  it("steps: a list or a single text", () => {
    expect(AddStepsInput.safeParse({ steps: ["a", "b"] }).success).toBe(true);
    expect(AddStepsInput.safeParse({ text: "a" }).success).toBe(true);
    expect(AddStepsInput.safeParse({}).success).toBe(false);
  });
  it("entity: dates are ISO strings, doneAt and dueDay may be null, priority must be known", () => {
    const t = { id: 1, title: "t", done: false, today: false, createdAt: "2026-10-02T10:00:00.000Z", doneAt: null, dueDay: null, priority: "normal", steps: [{ id: 1, text: "s", done: false, taskId: 1 }] };
    expect(Task.safeParse(t).success).toBe(true);
    expect(Task.safeParse({ ...t, priority: "mega" }).success).toBe(false);
    expect(Task.safeParse({ ...t, createdAt: "yesterday" }).success).toBe(false);
  });
});

describe("constants", () => {
  it("every priority has a point value, and the values match what the API has always awarded", () => {
    expect(Object.keys(TASK_PRIORITY_POINTS)).toEqual([...TASK_PRIORITIES]);
    expect(TASK_PRIORITY_POINTS).toEqual({ low: 2, normal: 4, high: 8, urgent: 14 });
  });
});

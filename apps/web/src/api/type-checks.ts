import { api } from "../api.ts";

// Type-level tests of the typed API client (P3-03). Nothing imports this file, so it never runs or ships; `pnpm
// typecheck` checks it. Each @ts-expect-error must stay an error: if the client ever stopped catching one of these
// mistakes, the unused @ts-expect-error itself would fail the typecheck.

declare const id: number;

export async function typedApiChecks() {
  // the answer has the route's type
  const tasks = await api.get("/tasks");
  const firstTitle: string | undefined = tasks[0]?.title;
  const range = await api.get(`/calendar?from=2026-10-05&to=2026-10-11`);
  const occurrence: string | undefined = range.events[0]?.occId;
  // a fixed route wins over one with a parameter
  const mail = await api.get("/emails/status");
  const ready: boolean = mail.ready;
  const added = await api.post(`/tasks/${id}/steps`, { steps: ["Open the file"] });
  const taskId: number = added.id;

  // @ts-expect-error a typo in the address
  await api.get("/taks");
  // @ts-expect-error the wrong method for a route
  await api.post("/health");
  // @ts-expect-error a body the route doesn't accept
  await api.post(`/tasks/${id}/steps`, { stepz: ["x"] });
  // @ts-expect-error a value the route doesn't allow
  await api.patch(`/tasks/${id}`, { priority: "whenever" });
  // @ts-expect-error a body is required here
  await api.post("/notes");

  return [firstTitle, occurrence, ready, taskId];
}

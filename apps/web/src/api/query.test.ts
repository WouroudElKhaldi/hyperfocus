import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

// the error toast needs a page; these tests only check the rules
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const { keyOf, optimistic, shouldRetry } = await import("./query.ts");

const httpError = (status: number) => Object.assign(new Error("x"), { status });

describe("cache keys", () => {
  it("come from the address, so a prefix covers everything under it", () => {
    expect(keyOf("/tasks")).toEqual(["api", "tasks"]);
    expect(keyOf("/tasks/12/steps")).toEqual(["api", "tasks", "12", "steps"]);
    expect(keyOf("/calendar?from=2026-10-05&to=2026-10-11")).toEqual(["api", "calendar", { from: "2026-10-05", to: "2026-10-11" }]);
  });
  it("refreshing /tasks also refreshes one task, but not notes", async () => {
    const client = new QueryClient();
    client.setQueryData(keyOf("/tasks/12"), { id: 12 });
    client.setQueryData(keyOf("/notes"), []);
    await client.invalidateQueries({ queryKey: keyOf("/tasks") });
    expect(client.getQueryState(keyOf("/tasks/12"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyOf("/notes"))?.isInvalidated).toBe(false);
  });
});

describe("retries", () => {
  it("never retry what the server refused (4xx), retry anything else once", () => {
    expect(shouldRetry(0, httpError(404))).toBe(false);
    expect(shouldRetry(0, httpError(429))).toBe(false);
    expect(shouldRetry(0, httpError(502))).toBe(true);
    expect(shouldRetry(0, new Error("Can't reach the server."))).toBe(true);
    expect(shouldRetry(1, httpError(502))).toBe(false);
  });
});

describe("optimistic changes", () => {
  it("show the change at once, and can put the old data back", async () => {
    const client = new QueryClient();
    const key = keyOf("/notes");
    client.setQueryData(key, ["old"]);
    const undo = await optimistic<string[]>(client, key, (list) => [...(list ?? []), "new"]);
    expect(client.getQueryData(key)).toEqual(["old", "new"]);
    undo();
    expect(client.getQueryData(key)).toEqual(["old"]);
  });
});

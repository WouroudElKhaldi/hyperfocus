import { OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { crudRouter, parseId } from "../../src/http/crud.ts";
import { problemResponse } from "../../src/http/problem.ts";
import { routeOwner } from "../../src/http/strangler.ts";

// The CRUD router factory (P2-03), tested in-process against a fake store kept in memory.

const Thing = z.object({ id: z.number(), name: z.string(), done: z.boolean() });
const CreateThing = z.object({ name: z.string({ error: "Name it." }).trim().min(1, "Name it.") });
const UpdateThing = z.object({ name: z.string(), done: z.boolean() }).partial();

function setup(ops = ["list", "get", "create", "update", "remove"]) {
  const rows = new Map();
  let next = 1;
  const all = {
    list: async ({ done }) => [...rows.values()].filter((r) => done === undefined || String(r.done) === done),
    get: async (id) => rows.get(id) ?? null,
    create: async (data) => { const r = { id: next++, done: false, ...data }; rows.set(r.id, r); return r; },
    update: async (id, data) => { const r = rows.get(id); if (!r) return null; Object.assign(r, data); return r; },
    remove: async (id) => rows.delete(id),
  };
  const store = Object.fromEntries(ops.map((o) => [o, all[o]]));
  const router = crudRouter({
    path: "/api/things", tag: "Things", name: "thing", item: Thing, notFound: "Thing not found.",
    listQuery: z.object({ done: z.string().optional() }), create: CreateThing, update: UpdateThing, store,
  });
  const app = new OpenAPIHono();
  app.onError((err, c) => problemResponse(c, err));
  app.route("/", router);
  const call = (method, path, body) => app.request(path, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  return { app, call, rows };
}

describe("CRUD router factory", () => {
  it("creates, lists (with a query filter), gets, updates and deletes", async () => {
    const { call } = setup();
    const a = await (await call("POST", "/api/things", { name: " A " })).json();
    expect(a).toEqual({ id: 1, name: "A", done: false });
    await call("POST", "/api/things", { name: "B" });
    expect((await (await call("GET", "/api/things")).json()).map((t) => t.name)).toEqual(["A", "B"]);
    expect(await (await call("PATCH", "/api/things/1", { done: true })).json()).toEqual({ id: 1, name: "A", done: true });
    expect((await (await call("GET", "/api/things?done=true")).json()).map((t) => t.name)).toEqual(["A"]);
    expect(await (await call("GET", "/api/things/1")).json()).toEqual({ id: 1, name: "A", done: true });
    expect(await (await call("DELETE", "/api/things/1")).json()).toEqual({ ok: true });
    expect((await call("GET", "/api/things/1")).status).toBe(404);
  });

  it("answers 404 with the module's message for a missing or impossible id", async () => {
    const { call } = setup();
    for (const [m, p, b] of [["GET", "/api/things/9"], ["PATCH", "/api/things/9", { done: true }], ["DELETE", "/api/things/9"], ["GET", "/api/things/abc"], ["DELETE", "/api/things/0"]]) {
      const r = await call(m, p, b);
      expect(r.status, `${m} ${p}`).toBe(404);
      expect((await r.json()).error).toBe("Thing not found.");
    }
  });

  it("checks request bodies with the schemas, keeping their messages", async () => {
    const { call, rows } = setup();
    const r = await call("POST", "/api/things", { name: "   " });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ status: 400, error: "Name it." });
    expect((await call("POST", "/api/things", {})).status).toBe(400);
    await call("POST", "/api/things", { name: "ok" });
    expect((await call("PATCH", "/api/things/1", { done: "yes" })).status).toBe(400);
    expect(rows.get(1).done).toBe(false); // nothing changed
  });

  it("only builds the routes the store provides, so porting never adds a route", () => {
    const { app } = setup(["list", "create"]);
    const owns = routeOwner(app);
    expect(owns("GET", "/api/things")).toBe(true);
    expect(owns("POST", "/api/things")).toBe(true);
    expect(owns("GET", "/api/things/1")).toBe(false);
    expect(owns("PATCH", "/api/things/1")).toBe(false);
    expect(owns("DELETE", "/api/things/1")).toBe(false);
  });

  it("documents the routes in OpenAPI", () => {
    const { app } = setup();
    const doc = app.getOpenAPI31Document({ openapi: "3.1.0", info: { title: "t", version: "1" } });
    expect(Object.keys(doc.paths)).toEqual(["/api/things", "/api/things/{id}"]);
    expect(Object.keys(doc.paths["/api/things/{id}"])).toEqual(["get", "patch", "delete"]);
  });

  it("reads ids strictly", () => {
    expect([parseId("12"), parseId("0"), parseId("-1"), parseId("1.5"), parseId("abc"), parseId("")]).toEqual([12, null, null, null, null, null]);
  });
});

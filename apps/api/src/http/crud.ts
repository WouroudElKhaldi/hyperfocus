import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppEnv } from "../app.ts";
import { httpError } from "../types.ts";
import { defaultHook } from "./validation.ts";

// The CRUD router factory (P2-03). Most modules have the same five routes: list, get one, create, update, delete.
// Give it the schemas and a small store, and it builds those routes with request checks, OpenAPI docs and the same
// answers everywhere: the item as JSON, { ok: true } after a delete, and a 404 problem when the id doesn't exist.
//
// Only the operations the store provides become routes, so porting a module never adds a route the API didn't have.

/** Reads a record id from the path. Anything that isn't a positive whole number can't exist, so it is a 404 too. */
export const parseId = (raw: string): number | null => (/^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);

/** What a module provides. `null` from get/update/remove means "no such record". */
export type CrudStore<Create, Update, Query> = {
  list?: (query: Query) => Promise<unknown[]>;
  get?: (id: number) => Promise<unknown | null>;
  create?: (data: Create) => Promise<unknown>;
  update?: (id: number, data: Update) => Promise<unknown | null>;
  remove?: (id: number) => Promise<boolean>;
};

export type CrudDefinition<Q extends z.ZodObject, C extends z.ZodType, U extends z.ZodType> = {
  /** The collection path, like "/api/notes". Single records live at `${path}/{id}`. */
  path: `/api/${string}`;
  /** The OpenAPI group, like "Notes". */
  tag: string;
  /** What one record is called in the docs, like "note". */
  name: string;
  /** Shape of one record (docs and types). */
  item: z.ZodType;
  /** Shape of one record in the list, when it carries more than `item`. */
  listItem?: z.ZodType;
  /** Query parameters of the list (e.g. a filter). */
  listQuery?: Q;
  create?: C;
  update?: U;
  /** The 404 message, like "Note not found." */
  notFound: string;
  store: CrudStore<z.output<C>, z.output<U>, z.output<Q>>;
};

// The request parts zod-openapi has already checked. The factory's routes are built from generic schemas, which the
// route types can't follow, so the checked values are read here, in one place, with the type the schema gives them.
const checked = <T>(c: Context, part: "json" | "query"): T => c.req.valid(part as never) as T;

// Building blocks for module routes beyond the five the factory makes (like POST /api/tasks/{id}/steps).
export const Ok = z.object({ ok: z.literal(true) }).openapi("Ok");
export const IdParam = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, example: "12" }) });
/** A JSON response in a route definition. */
// (response schemas document the route; they are not used to type the handler, because the database returns plain strings
// where a schema lists allowed values, like a task's priority)
export const json = (schema: z.ZodType, description: string) => ({ description, content: { "application/json": { schema } } });
/** A JSON request body in a route definition. */
export const body = <S extends z.ZodType>(schema: S) => ({ content: { "application/json": { schema } }, required: true as const });
/** An error response in a route definition. */
export const problem = (description: string) => ({ description, content: { "application/problem+json": { schema: z.object({ status: z.number(), error: z.string() }) } } });
/** The record id from the path, or a 404 with `notFound` when it can't be a record id. */
export const pathId = (raw: string | undefined, notFound: string) => {
  const id = parseId(raw ?? "");
  if (id === null) throw httpError(404, notFound);
  return id;
};

export function crudRouter<Q extends z.ZodObject = z.ZodObject<{}>, C extends z.ZodType = z.ZodNever, U extends z.ZodType = z.ZodNever>(def: CrudDefinition<Q, C, U>) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const { path, tag, name, store } = def;
  const one = `${path}/{id}`;
  const idOf = (raw: string) => pathId(raw, def.notFound);
  const found = <T>(row: T | null) => {
    if (row === null) throw httpError(404, def.notFound);
    return row;
  };

  if (store.list) {
    const list = store.list;
    const route = createRoute({
      method: "get", path, tags: [tag], summary: `List ${name}s`,
      ...(def.listQuery ? { request: { query: def.listQuery } } : {}),
      responses: { 200: json(z.array(def.listItem ?? def.item), `The ${name}s`) },
    });
    app.openapi(route, async (c) => c.json(await list(checked<z.output<Q>>(c, "query")), 200));
  }
  if (store.get) {
    const get = store.get;
    const route = createRoute({ method: "get", path: one, tags: [tag], summary: `One ${name}`, request: { params: IdParam }, responses: { 200: json(def.item, `The ${name}`), 404: problem(`No such ${name}`) } });
    app.openapi(route, async (c) => c.json(found(await get(idOf(c.req.param("id") ?? ""))), 200));
  }
  if (store.create && def.create) {
    const create = store.create;
    const route = createRoute({
      method: "post", path, tags: [tag], summary: `Create a ${name}`,
      request: { body: { content: { "application/json": { schema: def.create } }, required: true } },
      responses: { 200: json(def.item, `The new ${name}`), 400: problem("The request isn't valid") },
    });
    app.openapi(route, async (c) => c.json(await create(checked<z.output<C>>(c, "json")), 200));
  }
  if (store.update && def.update) {
    const update = store.update;
    const route = createRoute({
      method: "patch", path: one, tags: [tag], summary: `Change a ${name} (only the fields sent change)`,
      request: { params: IdParam, body: { content: { "application/json": { schema: def.update } }, required: true } },
      responses: { 200: json(def.item, `The ${name} after the change`), 400: problem("The request isn't valid"), 404: problem(`No such ${name}`) },
    });
    app.openapi(route, async (c) => {
      const id = idOf(c.req.param("id") ?? "");
      return c.json(found(await update(id, checked<z.output<U>>(c, "json"))), 200);
    });
  }
  if (store.remove) {
    const remove = store.remove;
    const route = createRoute({ method: "delete", path: one, tags: [tag], summary: `Delete a ${name}`, request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: problem(`No such ${name}`) } });
    app.openapi(route, async (c) => {
      if (!(await remove(idOf(c.req.param("id") ?? "")))) throw httpError(404, def.notFound);
      return c.json({ ok: true as const }, 200);
    });
  }
  return app;
}

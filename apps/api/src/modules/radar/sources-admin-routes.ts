import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, body, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError } from "../../types.ts";

// Job sources for admins (P6-18): how each one is doing (last check, last success, its error, how many postings it
// gave and has, its last batch), switch one off or on, ask for a check soon, and add a company's Greenhouse or Lever
// job board. Admins only.

const NOT_FOUND = "No such job source.";
const ADMIN_ONLY = problem("Only admins can do this");
const DAY = 24 * 60 * 60 * 1000;
const KINDS = { greenhouse: "Greenhouse", lever: "Lever" } as const;

const Source = z.object({
  id: z.number(), key: z.string(), kind: z.string(), name: z.string(), enabled: z.boolean(),
  status: z.enum(["ok", "failing", "waiting", "off"]).openapi({ description: "ok: its last check worked · failing: its last check failed · waiting: not checked yet · off: switched off" }),
  lastRunAt: z.string().nullable(), lastOkAt: z.string().nullable(), lastError: z.string(), lastItems: z.number(),
  postings: z.number().openapi({ description: "Postings from it that are still shown" }),
  newThisWeek: z.number(),
  lastBatch: z.object({ status: z.string(), received: z.number(), created: z.number(), duplicates: z.number(), failed: z.number(), at: z.string() }).nullable(),
}).openapi("JobSourceHealth");

type Row = { id: number; key: string; kind: string; name: string; enabled: boolean; lastRunAt: Date | null; lastOkAt: Date | null; lastError: string; lastItems: number };
const statusOf = (s: Row) => (!s.enabled ? "off" : !s.lastRunAt ? "waiting" : s.lastError ? "failing" : "ok");

export function sourcesAdminRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.use("/api/admin/job-sources/*", async (c, next) => {
    if (c.get("role") !== "admin") throw httpError(403, "Only admins can do this.");
    await next();
  });
  app.use("/api/admin/job-sources", async (c, next) => {
    if (c.get("role") !== "admin") throw httpError(403, "Only admins can do this.");
    await next();
  });

  const health = async (s: Row) => {
    const [postings, newThisWeek, batch] = await Promise.all([
      prisma.jobPosting.count({ where: { sourceId: s.id, archivedAt: null } }),
      prisma.jobPosting.count({ where: { sourceId: s.id, createdAt: { gte: new Date(Date.now() - 7 * DAY) } } }),
      prisma.ingestBatch.findFirst({ where: { sourceId: s.id }, orderBy: { id: "desc" }, select: { status: true, received: true, created: true, duplicates: true, failed: true, createdAt: true } }),
    ]);
    return {
      id: s.id, key: s.key, kind: s.kind, name: s.name, enabled: s.enabled, status: statusOf(s),
      lastRunAt: s.lastRunAt?.toISOString() ?? null, lastOkAt: s.lastOkAt?.toISOString() ?? null, lastError: s.lastError, lastItems: s.lastItems,
      postings, newThisWeek,
      lastBatch: batch ? { status: batch.status, received: batch.received, created: batch.created, duplicates: batch.duplicates, failed: batch.failed, at: batch.createdAt.toISOString() } : null,
    };
  };
  const one = async (id: number) => {
    const s = await prisma.jobSource.findUnique({ where: { id } });
    if (!s) throw httpError(404, NOT_FOUND);
    return s;
  };

  app.openapi(
    createRoute({ method: "get", path: "/api/admin/job-sources", tags: ["Admin"], summary: "Every job source and how it is doing", responses: { 200: json(z.array(Source), "The sources"), 403: ADMIN_ONLY } }),
    async (c) => c.json(await Promise.all((await prisma.jobSource.findMany({ orderBy: { id: "asc" } })).map(health)), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/admin/job-sources", tags: ["Admin"], summary: "Add a company's Greenhouse or Lever job board",
      request: { body: body(z.object({
        kind: z.enum(["greenhouse", "lever"]),
        board: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,80}$/i, "The board's name, as in its address: boards.greenhouse.io/<name> or jobs.lever.co/<name>"),
        name: z.string().trim().min(1).max(100).optional(),
      })) },
      responses: { 201: json(Source, "Added; it is checked within the next few minutes"), 403: ADMIN_ONLY, 409: problem("Already there") },
    }),
    async (c) => {
      const { kind, board, name } = c.req.valid("json");
      const key = `${kind}:${board.toLowerCase()}`;
      if (await prisma.jobSource.findUnique({ where: { key } })) throw httpError(409, `${key} is already a source.`);
      const s = await prisma.jobSource.create({ data: { key, kind, name: name ?? `${board} (${KINDS[kind]})`, config: { board: board.toLowerCase() } } });
      return c.json(await health(s), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "patch", path: "/api/admin/job-sources/{id}", tags: ["Admin"], summary: "Switch a source on or off, rename it, or check it soon",
      request: { params: IdParam, body: body(z.object({ enabled: z.boolean().optional(), name: z.string().trim().min(1).max(100).optional(), checkSoon: z.boolean().optional() })) },
      responses: { 200: json(Source, "The source"), 403: ADMIN_ONLY, 404: problem(NOT_FOUND) },
    }),
    async (c) => {
      const id = pathId(c.req.param("id"), NOT_FOUND);
      await one(id);
      const { enabled, name, checkSoon } = c.req.valid("json");
      const s = await prisma.jobSource.update({
        where: { id },
        data: { ...(enabled === undefined ? {} : { enabled }), ...(name ? { name } : {}), ...(checkSoon ? { lastRunAt: null } : {}) },
      });
      return c.json(await health(s), 200);
    },
  );
  return app;
}

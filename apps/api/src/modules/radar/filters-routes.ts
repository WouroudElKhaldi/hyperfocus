import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { JobFilterSpec } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, body, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { presetForField } from "../../taxonomy/presets.ts";
import { previewFilter } from "../../radar/matcher.ts";
import { httpError } from "../../types.ts";

// Your Job Radar filters (P6-20): as many as you like, each with a name, on or off, and what it looks for (a
// JobFilterSpec). One click from a "I study ___" preset (P6-07). New and changed filters are matched against recent
// postings (P6-23).

const MAX_FILTERS = 20;
const NOT_FOUND = "Filter not found.";

const Filter = z
  .object({ id: z.number(), name: z.string(), enabled: z.boolean(), spec: JobFilterSpec, createdAt: z.string(), updatedAt: z.string() })
  .openapi("JobFilter");
const CreateFilter = z.object({ name: z.string().trim().min(1, "Give the filter a name.").max(80), enabled: z.boolean().optional(), spec: JobFilterSpec.optional() });
const UpdateFilter = z.object({ name: z.string().trim().min(1).max(80).optional(), enabled: z.boolean().optional(), spec: JobFilterSpec.optional() });

type Row = { id: number; name: string; enabled: boolean; spec: unknown; createdAt: Date; updatedAt: Date };
/** As the API shows it: the spec read through the schema, so an older saved one gets today's defaults. */
const show = (f: Row) => ({ id: f.id, name: f.name, enabled: f.enabled, spec: JobFilterSpec.parse(f.spec ?? {}), createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() });

export function radarFiltersRouter({ prisma, events }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const changed = (filterId: number) => events.publish("JobFilterChanged", { filterId });
  const room = async () => {
    if ((await prisma.jobFilter.count()) >= MAX_FILTERS) throw httpError(400, `You can have up to ${MAX_FILTERS} filters. Delete one you don't use first.`);
  };

  app.openapi(
    createRoute({ method: "get", path: "/api/job-filters", tags: ["Job Radar"], summary: "Your Job Radar filters", responses: { 200: json(z.array(Filter), "Oldest first") } }),
    async (c) => c.json((await prisma.jobFilter.findMany({ orderBy: { id: "asc" } })).map(show), 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/job-filters", tags: ["Job Radar"], summary: "Make a filter",
      request: { body: body(CreateFilter) }, responses: { 200: json(Filter, "The new filter"), 400: problem("Not valid, or too many filters") },
    }),
    async (c) => {
      await room();
      const { name, enabled, spec } = c.req.valid("json");
      const f = await prisma.jobFilter.create({ data: { name, enabled: enabled ?? true, spec: JobFilterSpec.parse(spec ?? {}) } });
      await changed(f.id);
      return c.json(show(f), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/job-filters/preview", tags: ["Job Radar"], summary: "≈ how many jobs a week this filter would find (from the last 7 days)",
      request: { body: body(z.object({ spec: JobFilterSpec })) },
      responses: { 200: json(z.object({ perWeek: z.number(), examples: z.array(z.string()) }), "The estimate and a few examples") },
    }),
    async (c) => c.json(await previewFilter(prisma, JobFilterSpec.parse(c.req.valid("json").spec)), 200),
  );
  app.openapi(
    createRoute({
      method: "get", path: "/api/radar/status", tags: ["Job Radar"], summary: "Is Job Radar finding jobs: sources, last check, postings this week",
      responses: { 200: json(z.object({ sources: z.number(), lastCheckedAt: z.string().nullable(), trouble: z.array(z.string()), postingsThisWeek: z.number() }), "The state") },
    }),
    async (c) => {
      const sources = await prisma.jobSource.findMany({ where: { enabled: true }, select: { name: true, lastOkAt: true, lastError: true } });
      const last = sources.map((s) => s.lastOkAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
      const postingsThisWeek = await prisma.jobPosting.count({ where: { duplicateOfId: null, archivedAt: null, postedAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } } });
      return c.json({ sources: sources.length, lastCheckedAt: last ? new Date(last).toISOString() : null, trouble: sources.filter((s) => s.lastError).map((s) => s.name), postingsThisWeek }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/job-filters/from-preset", tags: ["Job Radar"], summary: "One click: \"I study ___\" becomes your filter",
      request: { body: body(z.object({ fieldCode: z.string().regex(/^cip:\d{2}(\.\d{2,4})?$/) })) },
      responses: { 200: json(Filter, "The new filter"), 400: problem("Too many filters"), 404: problem("No such field of study") },
    }),
    async (c) => {
      const preset = await presetForField(prisma, c.req.valid("json").fieldCode);
      if (!preset) throw httpError(404, "No such field of study.");
      await room();
      const f = await prisma.jobFilter.create({ data: { name: `${preset.field.label} jobs`, spec: preset.spec } });
      await changed(f.id);
      return c.json(show(f), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/job-filters/{id}", tags: ["Job Radar"], summary: "Rename, switch on or off, or change what it looks for",
      request: { params: IdParam, body: body(UpdateFilter) }, responses: { 200: json(Filter, "The filter"), 404: problem(NOT_FOUND) },
    }),
    async (c) => {
      const id = pathId(c.req.param("id"), NOT_FOUND);
      const { name, enabled, spec } = c.req.valid("json");
      const { count } = await prisma.jobFilter.updateMany({ where: { id }, data: { ...(name !== undefined ? { name } : {}), ...(enabled !== undefined ? { enabled } : {}), ...(spec ? { spec: JobFilterSpec.parse(spec) } : {}) } });
      if (!count) throw httpError(404, NOT_FOUND);
      if (spec || enabled) await changed(id);
      return c.json(show(await prisma.jobFilter.findFirstOrThrow({ where: { id } })), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "delete", path: "/api/job-filters/{id}", tags: ["Job Radar"], summary: "Delete a filter (and its matches)",
      request: { params: IdParam }, responses: { 200: json(z.object({ ok: z.literal(true) }), "Deleted"), 404: problem(NOT_FOUND) },
    }),
    async (c) => {
      const { count } = await prisma.jobFilter.deleteMany({ where: { id: pathId(c.req.param("id"), NOT_FOUND) } });
      if (!count) throw httpError(404, NOT_FOUND);
      return c.json({ ok: true as const }, 200);
    },
  );
  return app;
}

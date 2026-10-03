import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, body, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError } from "../../types.ts";

// The job list for admins (P6-09): find an occupation, fix its name or description, add the local names it goes by
// ("Mohandes Software" in Lebanon), add an occupation the datasets don't have, and merge duplicates (one is then shown
// as the other everywhere, like an ESCO occupation as its O*NET twin). Local names and local occupations are kept by
// every re-import; a changed name or description of an imported occupation comes back from its dataset on the next
// import of that dataset. Admins only.

const NOT_FOUND = "No such occupation.";
const ADMIN_ONLY = problem("Only admins can do this");
const PAGE = 25;

const Brief = z.object({ id: z.number(), code: z.string(), title: z.string(), source: z.string(), titles: z.number(), sameAs: z.object({ id: z.number(), title: z.string() }).nullable() }).openapi("TaxonomyOccupationBrief");
const Title = z.object({ id: z.number(), title: z.string(), lang: z.string(), kind: z.string() });
const Detail = Brief.omit({ titles: true }).extend({ description: z.string(), titles: z.array(Title), mergedHere: z.array(z.object({ id: z.number(), title: z.string(), code: z.string() })) }).openapi("TaxonomyOccupation");
const TitleId = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" } }) });

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function taxonomyAdminRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  for (const p of ["/api/admin/taxonomy", "/api/admin/taxonomy/*"]) {
    app.use(p, async (c, next) => {
      if (c.get("role") !== "admin") throw httpError(403, "Only admins can do this.");
      await next();
    });
  }

  const detail = async (id: number) => {
    const o = await prisma.occupation.findUnique({
      where: { id },
      include: { sameAs: { select: { id: true, title: true } }, titles: { orderBy: [{ kind: "asc" }, { title: "asc" }] }, sameAsOf: { select: { id: true, title: true, code: true }, orderBy: { title: "asc" } } },
    });
    if (!o) throw httpError(404, NOT_FOUND);
    return {
      id: o.id, code: o.code, title: o.title, source: o.source, description: o.description, sameAs: o.sameAs,
      titles: o.titles.map((t) => ({ id: t.id, title: t.title, lang: t.lang, kind: t.kind })), mergedHere: o.sameAsOf,
    };
  };

  app.openapi(
    createRoute({
      method: "get", path: "/api/admin/taxonomy/occupations", tags: ["Admin"], summary: "Find occupations by name, any of their titles, or code",
      request: { query: z.object({ q: z.string().max(100).default(""), page: z.coerce.number().int().min(0).default(0) }) },
      responses: { 200: json(z.object({ total: z.number(), items: z.array(Brief) }), "A page of them"), 403: ADMIN_ONLY },
    }),
    async (c) => {
      const { q, page } = c.req.valid("query");
      const text = q.trim();
      const where = text ? { OR: [{ title: { contains: text, mode: "insensitive" as const } }, { code: { startsWith: text } }, { titles: { some: { title: { contains: text, mode: "insensitive" as const } } } }] } : {};
      const [total, rows] = await Promise.all([
        prisma.occupation.count({ where }),
        prisma.occupation.findMany({ where, orderBy: [{ title: "asc" }, { id: "asc" }], skip: page * PAGE, take: PAGE, include: { sameAs: { select: { id: true, title: true } }, _count: { select: { titles: true } } } }),
      ]);
      return c.json({ total, items: rows.map((o) => ({ id: o.id, code: o.code, title: o.title, source: o.source, titles: o._count.titles, sameAs: o.sameAs })) }, 200);
    },
  );

  app.openapi(
    createRoute({ method: "get", path: "/api/admin/taxonomy/occupations/{id}", tags: ["Admin"], summary: "One occupation with all its names", request: { params: IdParam }, responses: { 200: json(Detail, "It"), 403: ADMIN_ONLY, 404: problem(NOT_FOUND) } }),
    async (c) => c.json(await detail(pathId(c.req.param("id"), NOT_FOUND)), 200),
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/admin/taxonomy/occupations", tags: ["Admin"], summary: "Add an occupation the datasets don't have (kept by every import)",
      request: { body: body(z.object({ title: z.string().trim().min(2).max(200), description: z.string().trim().max(2000).default("") })) },
      responses: { 201: json(Detail, "Added"), 403: ADMIN_ONLY, 409: problem("Already there") },
    }),
    async (c) => {
      const { title, description } = c.req.valid("json");
      const code = `local:${slug(title) || Date.now()}`;
      if (await prisma.occupation.findUnique({ where: { code } })) throw httpError(409, `There is already a local occupation called ${title}.`);
      const o = await prisma.occupation.create({ data: { code, title, description, source: "local", version: "local", titles: { create: { title, kind: "preferred" } } } });
      return c.json(await detail(o.id), 201);
    },
  );

  app.openapi(
    createRoute({
      method: "patch", path: "/api/admin/taxonomy/occupations/{id}", tags: ["Admin"], summary: "Change its name or description, or merge it into another (null: unmerge)",
      request: { params: IdParam, body: body(z.object({ title: z.string().trim().min(2).max(200).optional(), description: z.string().trim().max(2000).optional(), sameAsId: z.number().int().nullable().optional() })) },
      responses: { 200: json(Detail, "It"), 400: problem("Can't merge it like that"), 403: ADMIN_ONLY, 404: problem(NOT_FOUND) },
    }),
    async (c) => {
      const id = pathId(c.req.param("id"), NOT_FOUND);
      const { title, description, sameAsId } = c.req.valid("json");
      await detail(id);
      let into: number | null | undefined = sameAsId;
      if (sameAsId != null) {
        if (sameAsId === id) throw httpError(400, "An occupation can't be merged into itself.");
        const target = await prisma.occupation.findUnique({ where: { id: sameAsId }, select: { id: true, sameAsId: true } });
        if (!target) throw httpError(400, "The occupation to merge into doesn't exist.");
        into = target.sameAsId ?? target.id; // (into the one it is shown as: no chains)
        if (into === id) throw httpError(400, "That one is already merged into this one.");
        // what was merged into this one now goes with it
        await prisma.occupation.updateMany({ where: { sameAsId: id }, data: { sameAsId: into } });
      }
      await prisma.occupation.update({ where: { id }, data: { ...(title ? { title } : {}), ...(description === undefined ? {} : { description }), ...(into === undefined ? {} : { sameAsId: into }) } });
      return c.json(await detail(id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post", path: "/api/admin/taxonomy/occupations/{id}/titles", tags: ["Admin"], summary: "Add a local name it goes by (found by the typeahead and the matching)",
      request: { params: IdParam, body: body(z.object({ title: z.string().trim().min(2).max(200), lang: z.string().regex(/^[a-z]{2}$/).default("en") })) },
      responses: { 200: json(Detail, "It, with the new name"), 403: ADMIN_ONLY, 404: problem(NOT_FOUND), 409: problem("It already has that name") },
    }),
    async (c) => {
      const id = pathId(c.req.param("id"), NOT_FOUND);
      const { title, lang } = c.req.valid("json");
      await detail(id);
      const r = await prisma.occupationTitle.createMany({ data: [{ occupationId: id, title, lang, kind: "local" }], skipDuplicates: true });
      if (!r.count) throw httpError(409, `It is already called ${title}.`);
      return c.json(await detail(id), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "delete", path: "/api/admin/taxonomy/titles/{id}", tags: ["Admin"], summary: "Remove a local name (names from the datasets stay)",
      request: { params: TitleId },
      responses: { 204: { description: "Removed" }, 400: problem("Not a local name"), 403: ADMIN_ONLY, 404: problem("No such name") },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const t = await prisma.occupationTitle.findUnique({ where: { id } });
      if (!t) throw httpError(404, "No such name.");
      if (t.kind !== "local") throw httpError(400, "Only local names can be removed: this one comes from a dataset.");
      await prisma.occupationTitle.delete({ where: { id } });
      return c.body(null, 204);
    },
  );
  return app;
}

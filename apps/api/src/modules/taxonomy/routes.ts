import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { json } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { SEARCH_KINDS, searchTaxonomy } from "../../taxonomy/search.ts";

// The taxonomy for the website (P6-06): typeahead search over occupations, skills, fields of study, cities, countries
// and industries.

const Hit = z
  .object({
    id: z.union([z.number(), z.string()]),
    code: z.string().openapi({ example: "onet:15-1252.00" }),
    label: z.string().openapi({ example: "Software Developers" }),
    detail: z.string().openapi({ example: "also called \"Frontend Engineer\" · Computer and Mathematical Occupations" }),
  })
  .openapi("TaxonomyHit");

export function taxonomyRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({
      method: "get", path: "/api/taxonomy/search", tags: ["Taxonomy"], summary: "Typeahead: the best matches for a few letters (typos forgiven)",
      request: {
        query: z.object({
          kind: z.enum(SEARCH_KINDS),
          q: z.string().max(80),
          limit: z.coerce.number().int().min(1).max(25).default(10),
        }),
      },
      responses: { 200: json(z.object({ items: z.array(Hit) }), "Best first (empty under 2 letters)") },
    }),
    async (c) => {
      const { kind, q, limit } = c.req.valid("query");
      return c.json({ items: await searchTaxonomy(prisma, kind, q, limit) }, 200);
    },
  );
  return app;
}

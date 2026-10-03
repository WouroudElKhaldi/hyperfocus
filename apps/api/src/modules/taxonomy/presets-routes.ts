import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { JobFilterSpec } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError } from "../../types.ts";
import { MAJORS, presetForField } from "../../taxonomy/presets.ts";

// Student starter presets (P6-07): the hand-picked majors, and a ready-made Job Radar filter for any field of study.

const Major = z.object({ code: z.string(), label: z.string(), group: z.string() }).openapi("Major");
const Preset = z.object({ field: z.object({ code: z.string(), label: z.string() }), spec: JobFilterSpec, summary: z.string() }).openapi("JobFilterPreset");

export function presetsRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/presets/majors", tags: ["Job Radar"], summary: "The majors students pick most, grouped (40, picked by hand)", responses: { 200: json(z.array(Major), "The majors") } }),
    (c) => c.json(MAJORS, 200),
  );
  app.openapi(
    createRoute({
      method: "get", path: "/api/presets/fields/{code}", tags: ["Job Radar"], summary: "\"I study ___\": a ready-made Job Radar filter for a field of study",
      request: { params: z.object({ code: z.string().regex(/^cip:\d{2}(\.\d{2,4})?$/).openapi({ param: { name: "code", in: "path" }, example: "cip:11.0701" }) }) },
      responses: { 200: json(Preset, "The filter, ready to save"), 404: problem("No such field of study (import the taxonomy first)") },
    }),
    async (c) => {
      const preset = await presetForField(prisma, c.req.valid("param").code);
      if (!preset) throw httpError(404, "No such field of study. (Is the taxonomy imported? pnpm taxonomy:import all --download)");
      return c.json(preset, 200);
    },
  );
  return app;
}

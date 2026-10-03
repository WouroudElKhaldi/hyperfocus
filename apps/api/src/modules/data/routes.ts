import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { getSettings, saveSettings } from "../../notify.ts";
import { attachmentFiles } from "../../storage/attachments.ts";
import { httpError } from "../../types.ts";
import { exportAll, ImportError, importAll } from "./portable.ts";

// P4-08: "Export my data" (a zip of everything) and its way back in (into an empty database only). See portable.ts.

const ImportResult = z.object({ ok: z.literal(true), tables: z.record(z.string(), z.number()) }).openapi("ImportResult");

export function dataRouter({ prisma, files }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const store = attachmentFiles(files ?? null);
  app.openapi(
    createRoute({
      method: "get", path: "/api/export", tags: ["Data"], summary: "Export my data: every table as JSON plus the attached files, in one zip",
      responses: { 200: { description: "The zip", content: { "application/zip": { schema: z.string().openapi({ format: "binary" }) } } } },
    }),
    async (c) => {
      const zip = await exportAll(prisma, store, getSettings());
      const day = new Date().toISOString().slice(0, 10);
      return c.body(Buffer.from(zip), 200, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="hyperfocus-export-${day}.zip"` });
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/import", tags: ["Data"], summary: "Bring an export back, into an empty database only (all or nothing)",
      request: { body: { content: { "application/zip": { schema: z.string().openapi({ format: "binary" }) } }, required: true } },
      responses: { 200: { description: "Imported", content: { "application/json": { schema: ImportResult } } }, 400: problem("Not an export, or the database isn't empty") },
    }),
    async (c) => {
      try {
        const r = await importAll(prisma, store, new Uint8Array(await c.req.arrayBuffer()));
        if (r.settings) saveSettings(r.settings);
        return c.json({ ok: true as const, tables: r.tables }, 200);
      } catch (e) {
        if (e instanceof ImportError) throw httpError(400, e.message);
        throw e;
      }
    },
  );
  return app;
}

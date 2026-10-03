import fs from "node:fs";
import { Readable } from "node:stream";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { backupDir, backupPath, createBackup, listBackups } from "../../backup.ts";
import { httpError } from "../../types.ts";

// Database backups (P2-20): list them, make one now, download one. Only files the backup module made can be downloaded
// (backupPath checks the name), so no path tricks are possible.

const Backup = z.object({ name: z.string(), size: z.number(), createdAt: z.string() });
const Backups = z.object({ backups: z.array(Backup), folder: z.string() }).openapi("Backups");
const NameParam = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" }, example: "thought-studio-2026-10-02_09-00-00.db" }) });

export function backupsRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/backups", tags: ["Backups"], summary: "The backups, newest first", responses: { 200: json(Backups, "The backups and their folder") } }),
    (c) => c.json({ backups: listBackups(), folder: backupDir() }, 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/backups", tags: ["Backups"], summary: "Make a backup now",
      responses: { 200: json(Backups.extend({ name: z.string() }), "The new backup's name, and the list") },
    }),
    async (c) => {
      const name = await createBackup(prisma);
      return c.json({ name, backups: listBackups(), folder: backupDir() }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get", path: "/api/backups/{name}/download", tags: ["Backups"], summary: "Download a backup file",
      request: { params: NameParam },
      responses: { 200: { description: "The database file", content: { "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) } } }, 404: problem("No such backup") },
    }),
    (c) => {
      const name = c.req.valid("param").name;
      const file = backupPath(name);
      if (!file) throw httpError(404, "Backup not found.");
      const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream<Uint8Array>;
      return c.body(stream, 200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fs.statSync(file).size),
        "Content-Disposition": `attachment; filename="${name}"`,
      });
    },
  );
  return app;
}

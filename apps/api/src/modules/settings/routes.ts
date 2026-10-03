import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { Settings, UpdateSettingsInput } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { Ok, body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { getSettings, notify, saveSettings } from "../../notify.ts";
import { httpError } from "../../types.ts";

// Reminder settings and the "send me a test notification" button (P2-20). Each person's own (P5-11).

export function settingsRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/settings", tags: ["Settings"], summary: "Your reminder settings", responses: { 200: json(Settings, "The settings") } }),
    async (c) => c.json(await getSettings(prisma), 200),
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/settings", tags: ["Settings"], summary: "Change reminder settings (wrong values are ignored)",
      request: { body: body(UpdateSettingsInput) }, responses: { 200: json(Settings, "The settings after the change") },
    }),
    async (c) => c.json(await saveSettings(prisma, c.req.valid("json")), 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/notify/test", tags: ["Settings"], summary: "Show a test notification on this computer",
      responses: { 200: json(Ok, "Shown"), 500: problem("The notification couldn't be shown") },
    }),
    async (c) => {
      const r = await notify("💜 Hyperfocus", "This is how your reminders will look.");
      if (!r.ok) throw httpError(500, `Couldn't show a notification: ${r.error}`);
      return c.json({ ok: true as const }, 200);
    },
  );
  return app;
}

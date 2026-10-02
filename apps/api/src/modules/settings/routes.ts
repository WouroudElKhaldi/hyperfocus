import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { Settings, UpdateSettingsInput } from "@hyperfocus/shared";
import type { AppEnv } from "../../app.ts";
import { Ok, body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { getSettings, notify, saveSettings } from "../../notify.ts";
import { httpError } from "../../types.ts";

// Reminder settings and the "send me a test notification" button (P2-20). The settings file also keeps a log of the
// reminders already sent (`sent`); it is never shown or changed from outside.

const visible = ({ sent: _, ...rest }: ReturnType<typeof getSettings>) => rest;

export function settingsRouter() {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/settings", tags: ["Settings"], summary: "Your reminder settings", responses: { 200: json(Settings, "The settings") } }),
    (c) => c.json(visible(getSettings()), 200),
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/settings", tags: ["Settings"], summary: "Change reminder settings (wrong values are ignored)",
      request: { body: body(UpdateSettingsInput) }, responses: { 200: json(Settings, "The settings after the change") },
    }),
    (c) => c.json(visible(saveSettings(c.req.valid("json"))), 200),
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

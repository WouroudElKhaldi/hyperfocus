import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { Ok, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError } from "../../types.ts";

// Your connected accounts (P5-07): which ones you have, and disconnecting one (its tokens are deleted). Connecting comes
// with each provider's sign-in flow (P5-08 Gmail, P5-09 LinkedIn). No route ever sends a token out.

const Connected = z
  .object({
    provider: z.string().openapi({ example: "gmail" }),
    account: z.string().openapi({ description: "Which account (an email address, a name)", example: "you@gmail.com" }),
    connectedAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("ConnectedAccount");
const ProviderParam = z.object({ provider: z.string().openapi({ param: { name: "provider", in: "path" }, example: "gmail" }) });

export function integrationsRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/integrations", tags: ["Integrations"], summary: "Your connected accounts (never their tokens)", responses: { 200: json(z.array(Connected), "What you have connected") } }),
    async (c) => {
      const rows = await prisma.integration.findMany({ orderBy: { provider: "asc" }, select: { provider: true, account: true, createdAt: true, updatedAt: true } });
      return c.json(rows.map((r) => ({ provider: r.provider, account: r.account, connectedAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "delete", path: "/api/integrations/{provider}", tags: ["Integrations"], summary: "Disconnect an account (its tokens are deleted)",
      request: { params: ProviderParam }, responses: { 200: json(Ok, "Disconnected"), 404: problem("That account isn't connected") },
    }),
    async (c) => {
      const { count } = await prisma.integration.deleteMany({ where: { provider: c.req.valid("param").provider } });
      if (!count) throw httpError(404, "That account isn't connected.");
      return c.json({ ok: true as const }, 200);
    },
  );
  return app;
}

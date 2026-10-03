import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { Ok, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError } from "../../types.ts";
import { CREDENTIALS, type CredentialKind, describe } from "../../credentials.ts";
import { integrations } from "../../integrations.ts";
import { aiUsage } from "../../ai-quota.ts";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { checkState as checkSigned } from "../../oauth-state.ts";
import { own } from "../../credentials.ts";
import { reachesPublic } from "../../http/public-address.ts";
import { linkedinExchange, linkedinStart } from "../../linkedin.ts";

// Your connected accounts (P5-07): which ones you have, saving your own credentials (DeepSeek key, n8n webhook, Gmail
// App Password), and disconnecting one (its secrets are deleted). The sign-in flows (P5-08 Gmail, P5-09 LinkedIn) add
// theirs. No route ever sends a secret out.

const Connected = z
  .object({
    provider: z.string().openapi({ example: "gmail" }),
    account: z.string().openapi({ description: "Which account (an email address, a name)", example: "you@gmail.com" }),
    connectedAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("ConnectedAccount");
const ProviderParam = z.object({ provider: z.string().openapi({ param: { name: "provider", in: "path" }, example: "gmail" }) });

const Usage = z
  .object({
    used: z.number().openapi({ description: "AI requests today on the app's key" }),
    limit: z.number().openapi({ description: "How many a day (0 = no limit)" }),
    ownKey: z.boolean().openapi({ description: "You use your own key: no limit" }),
    shared: z.boolean().openapi({ description: "You may use the app's key, with the daily limit (the owner shares it)" }),
    resetsAt: z.string().openapi({ description: "When the count starts again (midnight UTC)" }),
  })
  .openapi("AiUsage");

export function integrationsRouter({ prisma, secrets, config, log }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  // "Connect LinkedIn" (P5-09)
  // (with the person's own LinkedIn app, saved in Settings)
  const linkedinFor = () => {
    const app = own("linkedin-app");
    return app ? { ...config.linkedin, ...app, publicUrl: config.auth.publicUrl, secret: config.auth.secret } : null;
  };
  const LI_NONCE = "hf_linkedin_oauth";
  app.openapi(
    createRoute({
      method: "get", path: "/api/integrations/linkedin/start", tags: ["Integrations"], summary: "Start \"Connect LinkedIn\": where to send the browser",
      responses: { 200: json(z.object({ url: z.string() }), "LinkedIn's consent page"), 409: problem("Your LinkedIn app isn't saved yet") },
    }),
    (c) => {
      const linkedin = linkedinFor();
      if (!linkedin) throw httpError(409, "First save your LinkedIn app's Client ID and Client Secret (just above); the guide shows how to make one.");
      const { url, nonce } = linkedinStart(linkedin, c.get("userId"));
      setCookie(c, LI_NONCE, nonce, { httpOnly: true, sameSite: "Lax", path: "/api/integrations/linkedin", maxAge: 600, secure: linkedin.publicUrl.startsWith("https://") });
      return c.json({ url }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "get", path: "/api/integrations/linkedin/callback", tags: ["Integrations"], summary: "Where LinkedIn sends you back: saves the permission, then back to Settings",
      request: { query: z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }) },
      responses: { 302: { description: "Back to Settings, with ?connected=linkedin or ?connect-error=…" } },
    }),
    async (c) => {
      const back = (q: string) => c.redirect(`/backup?${q}`, 302);
      const fail = (m: string) => back(`connect-error=${encodeURIComponent(m)}&for=linkedin`);
      const { code, state, error } = c.req.valid("query");
      const nonce = getCookie(c, LI_NONCE);
      deleteCookie(c, LI_NONCE, { path: "/api/integrations/linkedin" });
      const linkedin = linkedinFor();
      if (!linkedin || !secrets) return fail("First save your LinkedIn app's Client ID and Client Secret.");
      if (error || !code || !state) return fail(error === "user_cancelled_authorize" || error === "user_cancelled_login" ? "You didn't allow it, so nothing changed." : "LinkedIn didn't finish connecting.");
      const wrong = checkSigned(linkedin.secret, state, c.get("userId"), nonce);
      if (wrong) return fail(wrong);
      try {
        const tokens = await linkedinExchange(linkedin, code);
        await integrations(prisma, secrets).save("linkedin", tokens.name || "LinkedIn", tokens);
        return back("connected=linkedin");
      } catch (e) {
        log.warn({ err: (e as Error).message }, "Connect LinkedIn failed");
        return fail((e as Error).message);
      }
    },
  );
  app.openapi(
    createRoute({ method: "get", path: "/api/ai/usage", tags: ["AI"], summary: "Your AI requests today and your daily limit (P5-10)", responses: { 200: json(Usage, "Today's usage") } }),
    async (c) => c.json(await aiUsage(prisma, config.aiDailyLimit)(), 200),
  );
  app.openapi(
    createRoute({ method: "get", path: "/api/integrations", tags: ["Integrations"], summary: "Your connected accounts (never their tokens)", responses: { 200: json(z.array(Connected), "What you have connected") } }),
    async (c) => {
      const rows = await prisma.integration.findMany({ orderBy: { provider: "asc" }, select: { provider: true, account: true, createdAt: true, updatedAt: true } });
      return c.json(rows.map((r) => ({ provider: r.provider, account: r.account, connectedAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "put", path: "/api/integrations/{provider}", tags: ["Integrations"],
      summary: "Save your own credentials: deepseek { apiKey }, n8n { webhookUrl }, gmail { user, appKey }",
      description: "Sealed before they are stored; never sent back. Used for your AI, LinkedIn posts and emails from then on.",
      request: { params: ProviderParam, body: { content: { "application/json": { schema: z.record(z.string(), z.string()) } }, required: true } },
      responses: { 200: json(Connected, "Saved"), 400: problem("Something is missing or wrong"), 404: problem("Not something you can save here") },
    }),
    async (c) => {
      const provider = c.req.valid("param").provider;
      if (!(provider in CREDENTIALS)) throw httpError(404, "Not something you can save here.");
      const kind = provider as CredentialKind;
      const parsed = CREDENTIALS[kind].safeParse(c.req.valid("json"));
      if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Something is missing.");
      // the server sends your posts to this address: on the hosted app it must be a public https one, never one of our machines
      if (kind === "n8n" && config.mode === "cloud" && !config.allowLocalAddresses && !(await reachesPublic((parsed.data as { webhookUrl: string }).webhookUrl))) {
        throw httpError(400, "On the hosted app the webhook must be a public https address (your n8n on your own computer can't be reached from here: use Connect LinkedIn).");
      }
      if (!secrets) throw httpError(500, "Saving credentials isn't possible: the app has no key to seal them with.");
      await integrations(prisma, secrets).save(kind, describe(kind, parsed.data), parsed.data);
      const r = await prisma.integration.findFirstOrThrow({ where: { provider }, select: { provider: true, account: true, createdAt: true, updatedAt: true } });
      return c.json({ provider: r.provider, account: r.account, connectedAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }, 200);
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

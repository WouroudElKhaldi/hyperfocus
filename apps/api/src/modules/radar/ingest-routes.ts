import { createHmac, timingSafeEqual } from "node:crypto";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { processBatch, receiveBatch } from "../../radar/ingest.ts";
import { httpError } from "../../types.ts";

// The ingest endpoint (P6-11): a workflow (your n8n, or anything else) delivers a batch of a source's raw postings.
// Signed with INGEST_SECRET: X-Signature: sha256=<hex HMAC-SHA256 of "<X-Timestamp>.<body>">, and the timestamp must be
// within 5 minutes (an old request can't be replayed). X-Idempotency-Key names the batch: sending it again does
// nothing. Up to 500 items and 5 MB. Answers 202: the batch is queued and processed in the background.
// Without INGEST_SECRET it is switched off (404).

const MAX_ITEMS = 500;
const SKEW_S = 300;

const Body = z.object({ source: z.string().min(1).max(100), cursor: z.string().max(2000).optional(), items: z.array(z.unknown()).max(MAX_ITEMS) });

/** "sha256=" + the HMAC of "<timestamp>.<body>" with the secret: what a sender puts in X-Signature. */
export const signIngest = (secret: string, timestamp: string, body: string) => `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

export function ingestRouter({ prisma, config, log }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({
      method: "post", path: "/api/ingest/jobs", tags: ["Job Radar"], summary: "Deliver a batch of postings (signed; for n8n or another workflow)",
      request: {
        // (checked in the handler, so a switched-off endpoint says 404 and a missing signature 401)
        headers: z.object({ "x-signature": z.string().optional(), "x-timestamp": z.string().optional(), "x-idempotency-key": z.string().max(200).optional() }),
        body: { content: { "application/json": { schema: Body } }, required: true },
      },
      responses: {
        202: json(z.object({ batchId: z.number(), replay: z.boolean(), status: z.string() }), "Queued (or already received)"),
        400: problem("Not a batch, or an unknown source"),
        401: problem("Not signed, or signed wrong, or too old"),
        404: problem("Ingest is switched off (no INGEST_SECRET)"),
      },
    }),
    async (c) => {
      const secret = config.ingestSecret;
      if (!secret) throw httpError(404, "Ingest is switched off on this server.");
      const raw = await c.req.text();
      const ts = c.req.header("x-timestamp") ?? "";
      const sig = c.req.header("x-signature") ?? "";
      const age = Math.abs(Date.now() / 1000 - Number(ts));
      const want = Buffer.from(signIngest(secret, ts, raw));
      const got = Buffer.from(sig);
      if (!/^\d{9,11}$/.test(ts) || !(age <= SKEW_S) || want.length !== got.length || !timingSafeEqual(want, got)) {
        throw httpError(401, "The batch isn't signed with this server's secret, or it is too old.");
      }
      let body: z.infer<typeof Body>;
      try {
        body = Body.parse(JSON.parse(raw));
      } catch (e) {
        throw httpError(400, e instanceof z.ZodError ? (e.issues[0]?.message ?? "Not a batch.") : "Not JSON.");
      }
      const key = c.req.header("x-idempotency-key") ?? "";
      if (!key) throw httpError(400, "Name the batch with an X-Idempotency-Key header.");
      const source = await prisma.jobSource.findUnique({ where: { key: body.source } });
      if (!source || !source.enabled) throw httpError(400, `No enabled source "${body.source}". An admin adds sources first.`);
      const { batchId, replay } = await receiveBatch(prisma, source, body.items, key, body.cursor ?? "");
      // processed in the background; a queued batch is also picked up by the "radar-ingest" job if this stops
      if (!replay) void processBatch(prisma, batchId).catch((e: unknown) => log.error({ err: e, batchId }, "ingest batch failed"));
      return c.json({ batchId, replay, status: replay ? "already received" : "queued" }, 202);
    },
  );
  return app;
}

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { prompts } from "@hyperfocus/ai";
import type { Review as Row } from "@hyperfocus/db";
import { Review } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { IdParam, Ok, json, pathId, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError } from "../../types.ts";
import { gatherWeek } from "./week.ts";

// The weekly review (P2-14): the numbers come from her own data (./week.ts), the AI only writes them up. Same answers as
// the Express routes had, plus the P2 fix: deleting a review that doesn't exist is a 404 (it was a 500).

const REVIEW_404 = "Review not found.";
// stats and content are stored as JSON text
const out = (r: Row) => ({ id: r.id, label: r.label, createdAt: r.createdAt, stats: JSON.parse(r.stats), content: JSON.parse(r.content) });

export function reviewsRouter({ prisma, events, ai }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  const tags = ["Weekly review"];
  app.openapi(
    createRoute({ method: "get", path: "/api/reviews", tags, summary: "The last 30 reviews, newest first", responses: { 200: json(z.array(Review), "The reviews") } }),
    async (c) => c.json((await prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 30 })).map(out), 200),
  );
  app.openapi(
    createRoute({ method: "post", path: "/api/reviews", tags, summary: "AI: write this week's review from her data, and save it", responses: { 200: json(Review, "The new review") } }),
    async (c) => {
      const { stats, facts, label } = await gatherWeek(prisma);
      const content = await ai.run(prompts.writeReview, { facts });
      const r = await prisma.review.create({ data: { label, stats: JSON.stringify(stats), content: JSON.stringify(content) } });
      await events.publish("ReviewWritten", { reviewId: r.id });
      return c.json(out(r), 200);
    },
  );
  app.openapi(
    createRoute({ method: "delete", path: "/api/reviews/{id}", tags, summary: "Delete a review", request: { params: IdParam }, responses: { 200: json(Ok, "Deleted"), 404: problem("No such review") } }),
    async (c) => {
      const { count } = await prisma.review.deleteMany({ where: { id: pathId(c.req.param("id"), REVIEW_404) } });
      if (!count) throw httpError(404, REVIEW_404);
      return c.json({ ok: true as const }, 200);
    },
  );
  return app;
}

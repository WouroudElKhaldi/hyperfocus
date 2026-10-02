import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { DEFAULT_AVATAR, Profile, UpdateProfileInput } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { compact } from "../../types.ts";

// The person using the app (P2-20): no login yet, just one saved profile. Same answers as the Express routes had.

const EMPTY_PROFILE = { name: "", role: "", location: "", email: "", linkedin: "", about: "", helps: "", avatar: DEFAULT_AVATAR };

export function profileRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/profile", tags: ["Profile"], summary: "Your profile (empty until saved)", responses: { 200: json(Profile, "The profile") } }),
    async (c) => c.json((await prisma.profile.findFirst()) ?? EMPTY_PROFILE, 200),
  );
  app.openapi(
    createRoute({
      method: "put", path: "/api/profile", tags: ["Profile"], summary: "Save your profile (only the fields sent change)",
      request: { body: body(UpdateProfileInput) }, responses: { 200: json(Profile, "The saved profile"), 400: problem("Something to fix") },
    }),
    async (c) => {
      const data = compact(c.req.valid("json"));
      const cur = await prisma.profile.findFirst();
      return c.json(cur ? await prisma.profile.update({ where: { id: cur.id }, data }) : await prisma.profile.create({ data }), 200);
    },
  );
  return app;
}

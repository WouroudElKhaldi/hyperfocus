import { OWNER_ID } from "../../owner.ts";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { DEFAULT_AVATAR, Profile, UpdateProfileInput } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { compact } from "../../types.ts";

// The person using the app (P2-20): no login yet, just one saved profile. Same answers as the Express routes had.

const EMPTY_PROFILE = { name: "", role: "", location: "", email: "", linkedin: "", about: "", helps: "", occupationCode: "", avatar: DEFAULT_AVATAR };

export function profileRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/profile", tags: ["Profile"], summary: "Your profile (empty until saved)", responses: { 200: json(Profile, "The profile") } }),
    async (c) => {
      const saved = await prisma.profile.findFirst();
      if (saved) return c.json(saved, 200);
      // a new account (P5-04) starts with the name it signed up with; the owner (local mode) starts empty, as before
      const userId = c.get("userId");
      const account = userId && userId !== OWNER_ID ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }) : null;
      return c.json(account ? { ...EMPTY_PROFILE, name: account.name, email: account.email } : EMPTY_PROFILE, 200);
    },
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

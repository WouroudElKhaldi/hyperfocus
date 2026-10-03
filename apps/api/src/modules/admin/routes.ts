import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { httpError } from "../../types.ts";

// The admin area (P5-06). Two roles: `user` (everyone) and `admin`. Admins see the people who have accounts and can
// make someone an admin, switch features on and off for everyone (feature flags), and see which outside services are
// connected. Taxonomy management joins here with P6-03. In local mode the owner is the admin.
// Every route here answers 403 to anyone who isn't an admin (checked once, in the middleware below).

const Person = z
  .object({ id: z.string(), name: z.string(), email: z.string(), role: z.enum(["user", "admin"]), createdAt: z.string() })
  .openapi("AdminPerson");
const Flag = z
  .object({ key: z.string(), enabled: z.boolean(), note: z.string(), updatedAt: z.string() })
  .openapi("FeatureFlag");
const Providers = z
  .object({
    mode: z.enum(["local", "cloud"]),
    ai: z.boolean().openapi({ description: "An AI key is set" }),
    linkedin: z.boolean().openapi({ description: "LinkedIn posting (n8n) is set up" }),
    email: z.boolean().openapi({ description: "Sending email is set up" }),
    google: z.boolean().openapi({ description: "Sign in with Google is set up" }),
    fileStorage: z.string().openapi({ description: "Where uploaded files go: database or disk" }),
    people: z.number().openapi({ description: "How many accounts there are" }),
  })
  .openapi("ProviderHealth");
const FlagKey = z.object({ key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/).openapi({ param: { name: "key", in: "path" }, example: "job-radar" }) });
const UserId = z.object({ id: z.string().min(1).openapi({ param: { name: "id", in: "path" } }) });

const person = (u: { id: string; name: string; email: string; role: string; createdAt: Date }) => ({
  id: u.id, name: u.name, email: u.email, role: u.role === "admin" ? ("admin" as const) : ("user" as const), createdAt: u.createdAt.toISOString(),
});
const flag = (f: { key: string; enabled: boolean; note: string; updatedAt: Date }) => ({ ...f, updatedAt: f.updatedAt.toISOString() });
const ADMIN_ONLY = problem("Only admins can do this");

export function adminRouter({ prisma, config }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.use("/api/admin/*", async (c, next) => {
    if (c.get("role") !== "admin") throw httpError(403, "Only admins can do this.");
    await next();
  });

  app.openapi(
    createRoute({ method: "get", path: "/api/admin/providers", tags: ["Admin"], summary: "Which outside services are connected", responses: { 200: json(Providers, "Their state"), 403: ADMIN_ONLY } }),
    async (c) =>
      c.json({
        mode: config.mode, ai: !!config.deepseek.apiKey, linkedin: !!config.n8nWebhookUrl, email: !!(config.gmail.user && config.gmail.appKey),
        google: !!config.auth.google, fileStorage: config.fileStorage.kind, people: await prisma.user.count(),
      }, 200),
  );

  app.openapi(
    createRoute({ method: "get", path: "/api/admin/users", tags: ["Admin"], summary: "Everyone with an account, newest first", responses: { 200: json(z.array(Person), "The people"), 403: ADMIN_ONLY } }),
    async (c) => {
      const people = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
      return c.json(people.map(person), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/admin/users/{id}", tags: ["Admin"], summary: "Make someone an admin, or a user again",
      request: { params: UserId, body: body(z.object({ role: z.enum(["user", "admin"]) })) },
      responses: { 200: json(Person, "The person after the change"), 400: problem("You can't take away your own admin role"), 403: ADMIN_ONLY, 404: problem("No such person") },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { role } = c.req.valid("json");
      // so there is always someone who can undo a mistake
      if (id === c.get("userId") && role !== "admin") throw httpError(400, "You can't take away your own admin role.");
      if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) throw httpError(404, "No such person.");
      const u = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, name: true, email: true, role: true, createdAt: true } });
      return c.json(person(u), 200);
    },
  );

  app.openapi(
    createRoute({ method: "get", path: "/api/admin/flags", tags: ["Admin"], summary: "Feature flags", responses: { 200: json(z.array(Flag), "Every flag"), 403: ADMIN_ONLY } }),
    async (c) => c.json((await prisma.featureFlag.findMany({ orderBy: { key: "asc" } })).map(flag), 200),
  );
  app.openapi(
    createRoute({
      method: "put", path: "/api/admin/flags/{key}", tags: ["Admin"], summary: "Switch a feature on or off for everyone (made if it is new)",
      request: { params: FlagKey, body: body(z.object({ enabled: z.boolean(), note: z.string().max(500).optional() })) },
      responses: { 200: json(Flag, "The flag"), 403: ADMIN_ONLY },
    }),
    async (c) => {
      const { key } = c.req.valid("param");
      const { enabled, note } = c.req.valid("json");
      const f = await prisma.featureFlag.upsert({ where: { key }, create: { key, enabled, note: note ?? "" }, update: { enabled, ...(note === undefined ? {} : { note }) } });
      return c.json(flag(f), 200);
    },
  );
  return app;
}

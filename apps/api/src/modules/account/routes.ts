import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { attachmentFiles } from "../../storage/attachments.ts";
import { asSystem } from "../../tenancy.ts";
import { httpError } from "../../types.ts";

// Deleting your account (P5-12, the only "delete everything" in the app; the right to be forgotten). Everything you
// own goes with it: every row (the database removes them with the account), your uploaded files in the file storage,
// your sessions, your connected accounts' secrets. It can't be undone, so: type DELETE, and your password if you have
// one (an account made with Google: you must have signed in within the last 10 minutes instead).
// Cloud mode only: in local mode the data is on your own computer (Settings → Backup, and the database is yours).

const FRESH_MS = 10 * 60_000;

export function accountRouter({ prisma, auth, files }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({
      method: "post", path: "/api/account/delete", tags: ["Account"], summary: "Delete my account and everything in it (cannot be undone)",
      request: { body: body(z.object({ confirm: z.string(), password: z.string().max(200).optional() })) },
      responses: {
        200: json(z.object({ ok: z.literal(true) }), "Deleted; you are signed out"),
        400: problem("Not confirmed, wrong password, or sign in again first"),
        404: problem("There are no accounts in local mode"),
      },
    }),
    async (c) => {
      if (!auth) throw httpError(404, "This copy runs in local mode: there is no account to delete. Your data is on this computer.");
      const { confirm, password } = c.req.valid("json");
      if (confirm !== "DELETE") throw httpError(400, "Type DELETE to confirm.");
      const userId = c.get("userId");
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) throw httpError(401, "Please sign in.");

      // prove it is really you
      const credential = await prisma.account.findFirst({ where: { userId, providerId: "credential" }, select: { password: true } });
      if (credential?.password) {
        if (!password) throw httpError(400, "Type your password to delete your account.");
        const ctx = await auth.$context;
        if (!(await ctx.password.verify({ hash: credential.password, password }))) throw httpError(400, "That password isn't right.");
      } else if (Date.now() - new Date(session.session.createdAt).getTime() > FRESH_MS) {
        throw httpError(400, "For your safety, sign out and sign in again, then delete your account within 10 minutes.");
      }

      // the uploaded files first (they live outside the database), then the account: every row it owns goes with it
      const stored = await prisma.emailAttachment.findMany({ where: { storageKey: { not: "" } }, select: { storageKey: true } });
      await attachmentFiles(files ?? null).remove(stored);
      await asSystem(() => prisma.user.delete({ where: { id: userId } }));
      c.header("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
      return c.json({ ok: true as const }, 200);
    },
  );
  return app;
}

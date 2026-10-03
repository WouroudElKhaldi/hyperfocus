import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";

// Your notifications in the app (P5-11): the bell at the top lists the latest ones, with how many are unread.

const Note = z.object({ id: z.number(), title: z.string(), body: z.string(), createdAt: z.string(), read: z.boolean() }).openapi("Notification");
const Inbox = z.object({ unread: z.number(), items: z.array(Note) }).openapi("NotificationInbox");

export function notificationsRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/notifications", tags: ["Notifications"], summary: "Your latest notifications (50) and how many are unread", responses: { 200: json(Inbox, "Newest first") } }),
    async (c) => {
      const [rows, unread] = await Promise.all([
        prisma.notification.findMany({ orderBy: { id: "desc" }, take: 50 }),
        prisma.notification.count({ where: { readAt: null } }),
      ]);
      return c.json({ unread, items: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt.toISOString(), read: !!n.readAt })) }, 200);
    },
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/notifications/read", tags: ["Notifications"], summary: "Mark notifications as read (these ids, or all of them)",
      request: { body: body(z.object({ ids: z.array(z.number().int()).max(200).optional() })) },
      responses: { 200: json(z.object({ unread: z.number() }), "How many are still unread") },
    }),
    async (c) => {
      const { ids } = c.req.valid("json");
      await prisma.notification.updateMany({ where: { readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
      return c.json({ unread: await prisma.notification.count({ where: { readAt: null } }) }, 200);
    },
  );
  return app;
}

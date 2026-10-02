import { CreateReminderInput, Reminder, UpdateReminderInput } from "@hyperfocus/shared";
import type { AppDeps } from "../../app.ts";
import { crudRouter } from "../../http/crud.ts";
import { compact, orNull } from "../../types.ts";

// Reminders she writes herself (P2-13). Same answers as the Express routes had. Changing a reminder that doesn't exist is
// now a 404 "Reminder not found." (it was a 500); deleting one that is already gone stays a quiet { ok: true }, as before.

export function remindersRouter({ prisma }: AppDeps) {
  return crudRouter({
    path: "/api/reminders",
    tag: "Reminders",
    name: "reminder",
    item: Reminder,
    create: CreateReminderInput,
    update: UpdateReminderInput,
    notFound: "Reminder not found.",
    store: {
      // everything still waiting, plus what popped up in the last 7 days; waiting ones first, soonest first
      list: () => {
        const since = new Date(Date.now() - 7 * 86400000);
        return prisma.reminder.findMany({ where: { OR: [{ done: false }, { lastFiredAt: { gte: since } }] }, orderBy: [{ done: "asc" }, { at: "asc" }] });
      },
      create: ({ title, at, repeat, note }) => prisma.reminder.create({ data: { title, at, ...compact({ repeat, note }) } }),
      update: (id, data) => {
        const done = data.at && data.at > new Date() ? { done: false } : {}; // moving it to the future re-arms it
        return orNull(prisma.reminder.update({ where: { id }, data: { ...compact(data), ...done } }));
      },
      remove: async (id) => {
        await prisma.reminder.deleteMany({ where: { id } });
        return true; // already gone is fine
      },
    },
  });
}

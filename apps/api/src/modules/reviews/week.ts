import type { StudySession } from "@hyperfocus/db";
import type { Db } from "../../types.ts";

// The numbers come from her own data, computed here. The AI only narrates them and never produces figures.
const DAY = 86400000;
const studyMs = (s: StudySession) => Math.max(0, (s.endedAt ? s.endedAt.getTime() - s.startedAt.getTime() : 0) - s.breakMs);
const mins = (ms: number) => Math.round(ms / 60000);
const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export async function gatherWeek(prisma: Db) {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * DAY);
  const prevFrom = new Date(now.getTime() - 14 * DAY);
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * DAY - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const sessions = await prisma.studySession.findMany({ where: { startedAt: { gte: prevFrom }, endedAt: { not: null } } });
  const thisWeek = sessions.filter((s) => s.startedAt >= from);
  const lastWeek = sessions.filter((s) => s.startedAt < from);
  const byCourse: Record<string, number> = {};
  for (const s of thisWeek) {
    const k = [s.course || "No course", s.part].filter(Boolean).join(" / ");
    byCourse[k] = (byCourse[k] || 0) + mins(studyMs(s));
  }
  const studyDays = new Set(thisWeek.map((s) => day(s.startedAt))).size;

  const tasksDone = await prisma.task.findMany({ where: { doneAt: { gte: from } } });
  const tasksOpen = await prisma.task.findMany({ where: { done: false } });
  const overdue = tasksOpen.filter((t) => t.dueDay && t.dueDay < today);

  const goals = await prisma.goal.findMany({ where: { status: "active" }, include: { actions: true, logs: { where: { createdAt: { gte: from } } } } });
  const posts = await prisma.post.findMany();
  const posted = posts.filter((p) => p.postedAt && p.postedAt >= from);
  const books = await prisma.book.findMany({ where: { status: "reading" } });
  const skills = await prisma.skill.findMany();
  const gaps = skills.filter((s) => s.level > 0 && s.target > s.level).sort((a, b) => b.target - b.level - (a.target - a.level)).slice(0, 3);
  const events = await prisma.event.findMany({ where: { day: { gte: today, lte: nextWeek } }, orderBy: { day: "asc" } });

  const stats = {
    studyMinutes: mins(thisWeek.reduce((t, s) => t + studyMs(s), 0)),
    studyMinutesLastWeek: mins(lastWeek.reduce((t, s) => t + studyMs(s), 0)),
    studySessions: thisWeek.length,
    studyDays,
    tasksDone: tasksDone.length,
    tasksOpen: tasksOpen.length,
    tasksOverdue: overdue.length,
    goalStepsDone: goals.reduce((t, g) => t + g.actions.filter((a) => a.done).length, 0),
    goalUpdates: goals.reduce((t, g) => t + g.logs.length, 0),
    postsPublished: posted.length,
    draftsWaiting: posts.filter((p) => p.status === "draft").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
  };

  const facts = {
    today,
    stats,
    studyByCourseMinutes: byCourse,
    studyNotes: thisWeek.filter((s) => s.notes.trim()).slice(0, 8).map((s) => `${s.course} ${s.part}: ${s.notes.trim().slice(0, 220)}`),
    tasksCompleted: tasksDone.slice(0, 15).map((t) => t.title),
    overdueTasks: overdue.slice(0, 5).map((t) => t.title),
    openTaskCount: tasksOpen.length,
    activeGoals: goals.map((g) => ({
      goal: g.refined || g.original,
      targetDate: g.targetDate ? day(g.targetDate) : null,
      stepsDone: g.actions.filter((a) => a.done).length,
      stepsTotal: g.actions.length,
      updatesThisWeek: g.logs.map((l) => l.text).slice(0, 5),
    })),
    postsPublishedThisWeek: posted.map((p) => ((p.draft || p.thought).split("\n")[0] ?? "").slice(0, 100)),
    currentlyReading: books.map((b) => b.title),
    biggestSkillGaps: gaps.map((s) => `${s.name} (level ${s.level}, goal ${s.target})`),
    upcomingEvents: events.map((e) => `${e.day} ${e.startTime} ${e.title}`.trim()),
  };
  return { stats, facts, label: `${day(from)} to ${day(now)}` };
}

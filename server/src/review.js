import { chat } from "./ai.js";

// The numbers come from her own data, computed here. The AI only narrates them and never produces figures.
const DAY = 86400000;
const studyMs = (s) => Math.max(0, (s.endedAt ? s.endedAt - s.startedAt : 0) - s.breakMs);
const mins = (ms) => Math.round(ms / 60000);
const day = (d) => new Date(d).toISOString().slice(0, 10);

export async function gatherWeek(prisma) {
  const now = new Date();
  const from = new Date(now - 7 * DAY);
  const prevFrom = new Date(now - 14 * DAY);
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * DAY - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const sessions = await prisma.studySession.findMany({ where: { startedAt: { gte: prevFrom }, endedAt: { not: null } } });
  const thisWeek = sessions.filter((s) => s.startedAt >= from);
  const lastWeek = sessions.filter((s) => s.startedAt < from);
  const byCourse = {};
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
    postsPublishedThisWeek: posted.map((p) => (p.draft || p.thought).split("\n")[0].slice(0, 100)),
    currentlyReading: books.map((b) => b.title),
    biggestSkillGaps: gaps.map((s) => `${s.name} (level ${s.level}, goal ${s.target})`),
    upcomingEvents: events.map((e) => `${e.day} ${e.startTime} ${e.title}`.trim()),
  };
  return { stats, facts, label: `${day(from)} to ${day(now)}` };
}

export async function writeReview(facts) {
  const out = await chat(
    [
      {
        role: "system",
        content: `You write a short, kind and honest weekly review for a 21-year-old software engineer (3 years of experience, working toward senior) with ADHD/autism traits, anxiety and procrastination.
Use ONLY the facts given. Never invent activities, numbers or events. Quote numbers exactly as given. Minutes: show as hours and minutes.
Tone: warm, specific, calm. Celebrate real wins. If the week was light, do not shame or pressure; say it plainly, normalise it, and suggest a tiny restart. Never use words like "failed", "lazy" or "should".
Reply ONLY with JSON:
{"headline": string (one warm sentence summing up the week),
 "wins": string[] (2-4 specific wins from the facts; if there truly are none, one gentle sentence about showing up by doing this review),
 "watch": string[] (0-2 gentle observations, like overdue tasks or no study days, phrased kindly),
 "priorities": [{"title": string (max 10 words, starts with a verb), "why": string (one short sentence)}] (exactly 3, chosen from her goals, overdue tasks, skill gaps and upcoming events),
 "tinyStart": string (a first step for priority 1 that takes under 2 minutes),
 "postIdea": string (one LinkedIn post idea based on something she really did or learned this week, or "" if nothing fits)}.`,
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
    { json: true, temperature: 0.5 },
  );
  const arr = (x) => (Array.isArray(x) ? x.map(String) : []);
  return {
    headline: String(out.headline ?? ""),
    wins: arr(out.wins),
    watch: arr(out.watch),
    priorities: (Array.isArray(out.priorities) ? out.priorities : []).slice(0, 3).map((p) => ({ title: String(p.title ?? ""), why: String(p.why ?? "") })).filter((p) => p.title),
    tinyStart: String(out.tinyStart ?? ""),
    postIdea: String(out.postIdea ?? ""),
  };
}

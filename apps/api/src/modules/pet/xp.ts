import type { EventBus } from "../../events.ts";
import { award, awardAtLeast, awardCapture, studyXp, taskXp, XP } from "../../pet.ts";
import type { Db } from "../../types.ts";

// The companion pet earns XP by listening to what happens elsewhere (P2-04). Each line is exactly the award the route
// used to give inline; the key makes every achievement count once (see award() in pet.ts).
export function petEarnsXp(events: EventBus, prisma: Db): void {
  events.on("NoteCaptured", ({ noteId }) => awardCapture(prisma, "thought", noteId));
  events.on("TaskCaptured", ({ taskId }) => awardCapture(prisma, "task", taskId));
  events.on("TaskCompleted", ({ taskId, title, priority }) => award(prisma, `task:${taskId}`, "task", taskXp(priority), `Finished: ${title}`));
  events.on("GoalStepDone", ({ stepId, text }) => award(prisma, `step:${stepId}`, "step", XP.step, `Goal step done: ${text}`));
  events.on("GoalAchieved", ({ goalId, text }) => award(prisma, `goal:${goalId}`, "goal", XP.goal, `Reached a goal: ${text.slice(0, 80)}`));
  events.on("PostPublished", ({ postId }) => award(prisma, `post:${postId}`, "post", XP.post, "Published a LinkedIn post"));
  events.on("StudySessionEnded", ({ sessionId, activeMinutes, course }) =>
    awardAtLeast(prisma, `study:${sessionId}`, "study", studyXp(activeMinutes), `Studied ${activeMinutes} min${course ? `: ${course}` : ""}`));
  events.on("WinLogged", ({ winId, text }) => award(prisma, `win:${winId}`, "win", XP.win, text));
  events.on("ReviewWritten", ({ reviewId }) => award(prisma, `review:${reviewId}`, "review", XP.review, "Did a weekly review"));
  events.on("SkillLevelledUp", ({ skillId, name, level }) => award(prisma, `skill:${skillId}:${level}`, "skill", XP.skill, `Skill level up: ${name}`));
  events.on("BookFinished", ({ bookId, title }) => award(prisma, `book:${bookId}`, "book", XP.book, `Finished a book: ${title}`));
}

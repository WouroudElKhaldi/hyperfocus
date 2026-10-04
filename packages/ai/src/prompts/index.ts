// Every prompt template, one per AI feature.
export { askAboutBook, type BookCandidate, type BookQuestion, matchBook } from "./books.ts";
export { type FreeWindow, parseEvent, planStudy } from "./calendar.ts";
export { analyzeGoal, GOAL_VERDICTS, jobSkills, ORGANIZE_KINDS, organize, skillPlan, stuckHelp, suggestSkills, taskSteps, winsSummary } from "./coach.ts";
export { companionReply } from "./companion.ts";
export { polishEmail } from "./email.ts";
export { postIdeas, polishDraft, rewritePost } from "./posts.ts";
export { writeReview } from "./review.ts";

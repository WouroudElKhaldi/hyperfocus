// The one place apps get the database client from. The schema lives in ../prisma/schema.prisma,
// and the client (with types for every model) is generated from it on install (`prisma generate`).
export { Prisma, PrismaClient } from "@prisma/client";
import type * as Rows from "@prisma/client";
// Each row as the app sees it: without its owner id (P5-02: every result leaves it out, see OWNER_OMIT below).
type Seen<T> = Omit<T, "userId">;
export type Book = Seen<Rows.Book>;
export type BookMessage = Seen<Rows.BookMessage>;
export type ChatMessage = Seen<Rows.ChatMessage>;
export type ChatThread = Seen<Rows.ChatThread>;
export type Email = Seen<Rows.Email>;
export type EmailAttachment = Seen<Rows.EmailAttachment>;
export type EmailTemplate = Seen<Rows.EmailTemplate>;
export type Event = Seen<Rows.Event>;
export type Goal = Seen<Rows.Goal>;
export type GoalAction = Seen<Rows.GoalAction>;
export type GoalLog = Seen<Rows.GoalLog>;
export type JobApplication = Seen<Rows.JobApplication>;
export type Note = Seen<Rows.Note>;
export type Pet = Seen<Rows.Pet>;
export type PetXp = Seen<Rows.PetXp>;
export type Post = Seen<Rows.Post>;
export type Profile = Seen<Rows.Profile>;
export type Reminder = Seen<Rows.Reminder>;
export type Review = Seen<Rows.Review>;
export type Skill = Seen<Rows.Skill>;
export type Step = Seen<Rows.Step>;
export type StudySession = Seen<Rows.StudySession>;
export type Task = Seen<Rows.Task>;
export type Win = Seen<Rows.Win>;

import type { Prisma as P } from "@prisma/client";
/**
 * P5-02: every user-owned row has a `userId`, but the API never sends it back: the person asking already knows it's theirs.
 * The app's client leaves it out of every result (`new PrismaClient({ omit: OWNER_OMIT })`).
 */
export const OWNER_OMIT = {
  note: { userId: true }, task: { userId: true }, step: { userId: true }, post: { userId: true }, studySession: { userId: true },
  goal: { userId: true }, goalAction: { userId: true }, goalLog: { userId: true }, event: { userId: true }, book: { userId: true },
  bookMessage: { userId: true }, skill: { userId: true }, review: { userId: true }, win: { userId: true }, pet: { userId: true },
  petXp: { userId: true }, chatThread: { userId: true }, chatMessage: { userId: true }, profile: { userId: true },
  reminder: { userId: true }, email: { userId: true }, emailTemplate: { userId: true }, emailAttachment: { userId: true },
  jobApplication: { userId: true },
} as const satisfies P.GlobalOmitConfig;

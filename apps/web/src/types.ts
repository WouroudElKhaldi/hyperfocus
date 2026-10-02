// What the API sends back, as the website receives it (dates arrive as ISO strings).
// They mirror apps/api/src. TODO(types): replaced by types inferred from the typed Hono client in P3-03,
// so the two sides can no longer drift apart.

export type Health = { ok: boolean; ai?: boolean; n8n?: boolean; demo?: boolean };

// ---------- notes, tasks ----------
export type Note = {
  id: number; kind: string; title: string; body: string; pinned: boolean; archived: boolean;
  createdAt: string; updatedAt: string; postIds: number[]; posted: boolean;
};
export type Step = { id: number; text: string; done: boolean; taskId: number };
export type Task = {
  id: number; title: string; done: boolean; today: boolean; createdAt: string; doneAt: string | null;
  dueDay: string | null; priority: string; steps: Step[];
};

// ---------- posts ----------
export type Post = {
  id: number; thought: string; draft: string; status: string; postedAt: string | null; scheduledAt: string | null;
  attempts: number; lastError: string; lastAttemptAt: string | null; noteId: number | null; createdAt: string; updatedAt: string;
};
export type RewriteResult = { draft: string; hookType: string; hooks: string[]; suggestions: string[] };
export type PolishResult = { draft: string; changes: string[] };
export type PostIdea = { angle: string; thought: string };

// ---------- study ----------
export type StudySession = {
  id: number; course: string; part: string; notes: string; startedAt: string; endedAt: string | null;
  breakMs: number; pausedAt: string | null; createdAt?: string;
};

// ---------- goals ----------
export type GoalAction = { id: number; text: string; done: boolean; goalId: number };
export type GoalLog = { id: number; text: string; createdAt: string; goalId: number };
export type Goal = {
  id: number; original: string; refined: string; targetDate: string | null; status: string; verdict: string;
  verdictNote: string; suggestion: string; analyzedAt: string | null; createdAt: string; actions: GoalAction[]; logs: GoalLog[];
};

// ---------- calendar ----------
export type CalendarEvent = {
  id: number; title: string; day: string; startTime: string; endTime: string; notes: string; category: string;
  allDay: boolean; location: string; repeat: string; repeatUntil: string; exceptions: string; remindMin: number; createdAt: string;
};
/** One day on which an event happens (a repeating event has many). */
export type Occurrence = Pick<CalendarEvent, "id" | "title" | "day" | "startTime" | "endTime" | "allDay" | "category" | "location" | "notes" | "repeat" | "repeatUntil" | "remindMin"> & { occId: string; baseDay: string };
export type CalendarData = {
  from: string; to: string; events: Occurrence[];
  // tasks and goals always have a day here: the API only returns the ones with a date in the range
  tasks: { id: number; title: string; day: string; done: boolean }[];
  goals: { id: number; title: string; day: string; status: string }[];
  study: Pick<StudySession, "id" | "course" | "part" | "startedAt" | "endedAt" | "pausedAt" | "breakMs">[];
  posts: { id: number; title: string; status: string; at: string | null }[];
};
export type ParsedEvent = { title: string; day: string; allDay: boolean; startTime: string; endTime: string; category: string; repeat: string; location: string };
export type StudyBlock = { day: string; startTime: string; endTime: string; minutes: number; title: string; why: string };

// ---------- books ----------
export type BookLink = { kind: "free" | "borrow" | "preview" | "buy" | "info"; label: string; url: string; source?: string; matched?: string };
export type BookResult = {
  summary: string; whyForYou: string; foundAuthor: string; links: BookLink[]; more: BookLink[];
  sourcesFailed: string[]; aiNote: string; searchedAt: string;
};
export type Book = {
  id: number; title: string; author: string; status: string; notes: string; result: string; foundAt: string | null; createdAt: string;
};
export type BookMessage = { id: number; bookId: number; role: string; content: string; createdAt: string };

// ---------- skills, reviews, wins ----------
export type Skill = { id: number; name: string; area: string; level: number; target: number; notes: string; createdAt: string; updatedAt: string };
export type SkillSuggestion = { name: string; area: string; why: string };
export type SkillPlan = { steps: string[]; books: { title: string; author: string }[] };
export type ReviewStats = {
  studyMinutes: number; studyMinutesLastWeek: number; studySessions: number; studyDays: number; tasksDone: number; tasksOpen: number;
  tasksOverdue: number; goalStepsDone: number; goalUpdates: number; postsPublished: number; draftsWaiting: number; scheduled: number;
};
export type ReviewContent = { headline: string; wins: string[]; watch: string[]; priorities: { title: string; why: string }[]; tinyStart: string; postIdea: string };
export type Review = { id: number; label: string; createdAt: string; stats: ReviewStats; content: ReviewContent };
export type Win = { id: string; kind: string; text: string; date: string; manual?: boolean; winId?: number };
export type WinsSummary = { bullets: string[]; paragraph: string };
export type StuckHelp = { validation: string; step: string; ifStillStuck: string; pick: string };

// ---------- profile, settings, reminders, backups ----------
export type Profile = { id?: number; name: string; role: string; location: string; email: string; linkedin: string; about: string; helps: string; avatar: string; updatedAt?: string };
export type Settings = { reminders: boolean; breakEveryMin: number; morningAt: string };
export type Reminder = { id: number; title: string; note: string; at: string; repeat: string; done: boolean; lastFiredAt: string | null; createdAt: string };
export type BackupFile = { name: string; size: number; createdAt: string };
export type Backups = { backups: BackupFile[]; folder: string; name?: string };

// ---------- chat ----------
export type ChatThread = { id: number; title: string; createdAt: string; updatedAt: string; count?: number };
export type ChatMessage = { id: number | string; role: string; content: string; createdAt: string; threadId?: number | null };
export type ChatReply = { user: ChatMessage; assistant: ChatMessage; crisis: boolean; temporary?: boolean; thread?: ChatThread };

// ---------- email, jobs ----------
export type Attachment = { id: number; filename: string; mime: string; size: number; inline: boolean };
export type JobRef = { id: number; company: string; title: string };
export type EmailListItem = {
  id: number; toAddr: string; ccAddr: string; subject: string; status: string; sentAt: string | null; lastError: string;
  createdAt: string; updatedAt: string; jobId: number | null; job: JobRef | null; preview: string; files: number;
};
export type Email = {
  id: number; toAddr: string; ccAddr: string; bccAddr: string; subject: string; html: string; body: string; status: string;
  sentAt: string | null; fromAddr: string; messageId: string; lastError: string; createdAt: string; updatedAt: string;
  jobId: number | null; job?: JobRef | null; attachments: Attachment[];
};
export type EmailTemplate = { id: number; name: string; subject: string; createdAt: string; updatedAt: string; preview: string; files: number };
export type MailStatus = { ready: boolean; user: string; hasKey: boolean; hasUser: boolean };
export type JobEmail = { id: number; subject: string; toAddr: string; status: string; sentAt: string | null; updatedAt: string };
export type Job = {
  id: number; company: string; title: string; url: string; location: string; salary: string; source: string; status: string;
  appliedAt: string | null; followUpDay: string | null; contactName: string; contactEmail: string; notes: string;
  createdAt: string; updatedAt: string;
};
export type JobListItem = Job & { emailCount: number; lastSentAt: string | null };
export type JobDetail = Job & { emails: JobEmail[] };

// ---------- AI helpers ----------
export type OrganizedItem = { kind: string; title: string; body: string };
export type GoalAnalysis = { goal: Goal; actions: string[] };

// ---------- companion pet ----------
export type UnlockRuleKind = "free" | "xp" | "tasks" | "studyMin" | "posts" | "streak" | "goals" | "books" | "wins";
/** Anything that can be unlocked (clothes, backdrops, patterns, auras), as the API describes it. */
export type Unlockable = {
  id: string; name: string; slot?: string; for: string; label: string; unlocked: boolean; have: number; need: number; kind: UnlockRuleKind;
};
export type Personality = { id: string; label: string; title: string; desc: string; perk: Record<string, number> };
export type AgeStep = { age: number; name: string; at: number };
export type PetPoints = { priority: Record<string, number>; other: Record<string, number>; capture: Record<"thought" | "task", { xp: number; cap: number; label: string }> };
export type PetCatalog = {
  ages: AgeStep[]; legendAt: number; items: Unlockable[]; backdrops: Unlockable[]; patterns: Unlockable[]; auras: Unlockable[];
  personalities: Personality[]; maxTraits: number; points: PetPoints;
};
export type PetData = {
  id: number; name: string; species: string; gender: string; color: string; traits: string[]; bio: string; style: string;
  outfit: string; pattern: string; aura: string; backdrop: string; createdAt: string;
};
export type Outfit = Record<string, string>;
export type PetStats = { tasks: number; steps: number; goals: number; posts: number; wins: number; reviews: number; books: number; studyMinutes: number; streak: number; bestStreak: number };
export type Badge = { id: string; label: string; desc: string; unlocked: boolean; progress: number; have: number; need: number };
export type Quest = { id: string; label: string; need: number; bonus: number; have: number; done: boolean };
export type PetState = PetCatalog & {
  pet: PetData; outfit: Outfit; xp: number; level: number; legend: boolean; nextAt: number | null; from: number; progress: number;
  stage: number; age: number; stageName: string; mood: string; stats: PetStats; badges: Badge[]; perks: Record<string, number>;
  today: { xp: number; quests: Quest[]; allDone: boolean; allBonus: number };
  ageDays: number; recent: { source: string; amount: number; note: string; createdAt: string }[];
};
/** GET /api/pet: `pet` is null until she has chosen one. */
export type PetResponse = PetState | { pet: null };

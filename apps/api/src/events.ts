// Domain events (P2-04). When something meaningful happens (a task is finished, a post goes live), the code that did it
// publishes an event, and whoever cares subscribes. The routes no longer know that the companion pet exists: the pet
// module listens for these events and gives XP (src/modules/pet/xp.ts). New reactions (notifications, a digest, Job
// Radar) subscribe the same way without touching the routes.
//
// publish() waits for every subscriber, one after another, so their work is done before the response is sent (as the
// XP was before). A subscriber that throws is logged and skipped: a side effect must never break what the user did.

/** Every event, with what it carries. */
export type DomainEvents = {
  NoteCaptured: { noteId: number };
  TaskCaptured: { taskId: number };
  TaskCompleted: { taskId: number; title: string; priority: string };
  GoalStepDone: { stepId: number; text: string };
  GoalAchieved: { goalId: number; text: string };
  PostPublished: { postId: number };
  StudySessionEnded: { sessionId: number; activeMinutes: number; course: string };
  WinLogged: { winId: number; text: string };
  ReviewWritten: { reviewId: number };
  SkillLevelledUp: { skillId: number; name: string; level: number };
  BookFinished: { bookId: number; title: string };
  /** P6: a Job Radar filter was made or changed: match it against recent postings */
  JobFilterChanged: { filterId: number };
  /** P6-30: a job was applied to from Job Radar */
  JobApplied: { matchId: number; applicationId: number; title: string };
};
export type EventName = keyof DomainEvents;
type Handler<K extends EventName> = (payload: DomainEvents[K]) => unknown;

export class EventBus {
  #handlers: { [K in EventName]?: Handler<K>[] } = {};
  readonly #onError: (event: EventName, err: unknown) => void;

  constructor(onError: (event: EventName, err: unknown) => void = (event, err) => console.error(`A subscriber to ${event} failed:`, err)) {
    this.#onError = onError;
  }

  /** Subscribes to an event. Returns a function that unsubscribes. */
  on<K extends EventName>(event: K, handler: Handler<K>): () => void {
    const list = (this.#handlers[event] ??= []) as Handler<K>[];
    list.push(handler);
    return () => { list.splice(list.indexOf(handler), 1); };
  }

  /** Publishes an event and waits for every subscriber (in the order they subscribed). Never throws. */
  async publish<K extends EventName>(event: K, payload: DomainEvents[K]): Promise<void> {
    for (const handler of [...((this.#handlers[event] ?? []) as Handler<K>[])]) {
      try {
        await handler(payload);
      } catch (err) {
        this.#onError(event, err);
      }
    }
  }
}

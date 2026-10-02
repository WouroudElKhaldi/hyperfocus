import { describe, expect, it } from "vitest";
import { EventBus } from "../../src/events.ts";
import { petEarnsXp } from "../../src/modules/pet/xp.ts";

// The domain event bus (P2-04).

describe("event bus", () => {
  it("runs every subscriber in order and waits for each one before publish() returns", async () => {
    const bus = new EventBus();
    const seen = [];
    bus.on("TaskCompleted", async (e) => { await new Promise((ok) => setTimeout(ok, 10)); seen.push(`slow ${e.taskId}`); });
    bus.on("TaskCompleted", (e) => { seen.push(`fast ${e.taskId}`); });
    await bus.publish("TaskCompleted", { taskId: 7, title: "t", priority: "high" });
    expect(seen).toEqual(["slow 7", "fast 7"]);
  });

  it("only calls the subscribers of that event", async () => {
    const bus = new EventBus();
    const seen = [];
    bus.on("WinLogged", () => seen.push("win"));
    await bus.publish("PostPublished", { postId: 1 });
    expect(seen).toEqual([]);
  });

  it("a failing subscriber is reported and skipped, never breaking the action or the other subscribers", async () => {
    const errors = [];
    const bus = new EventBus((event, err) => errors.push([event, err.message]));
    const seen = [];
    bus.on("BookFinished", () => { throw new Error("broken"); });
    bus.on("BookFinished", () => seen.push("still ran"));
    await expect(bus.publish("BookFinished", { bookId: 1, title: "x" })).resolves.toBeUndefined();
    expect(seen).toEqual(["still ran"]);
    expect(errors).toEqual([["BookFinished", "broken"]]);
  });

  it("can unsubscribe", async () => {
    const bus = new EventBus();
    let n = 0;
    const off = bus.on("ReviewWritten", () => { n++; });
    await bus.publish("ReviewWritten", { reviewId: 1 });
    off();
    await bus.publish("ReviewWritten", { reviewId: 2 });
    expect(n).toBe(1);
  });
});

describe("the pet earns XP from events", () => {
  it("listens to every kind of progress the routes used to award directly (11 events, 13 old call sites)", async () => {
    const bus = new EventBus();
    const subscribed = [];
    const on = bus.on.bind(bus);
    bus.on = (event, handler) => { subscribed.push(event); return on(event, handler); };
    petEarnsXp(bus, {});
    expect(subscribed.sort()).toEqual([
      "BookFinished", "GoalAchieved", "GoalStepDone", "NoteCaptured", "PostPublished", "ReviewWritten",
      "SkillLevelledUp", "StudySessionEnded", "TaskCaptured", "TaskCompleted", "WinLogged",
    ]);
  });
});

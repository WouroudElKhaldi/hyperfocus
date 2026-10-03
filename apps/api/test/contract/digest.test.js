import { afterAll, beforeAll, expect, it } from "vitest";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-11 part 4: the daily email digest. A cloud copy with its background jobs running; emails go to its log
// (MAIL_DRY_RUN). Bob switched the digest on (time already reached on his clock) and has something unread: one email, to
// him. Carol switched it on but read everything: no email. Alice didn't switch it on: no email.

let api, bob, carol, alice;
const digests = () => api.log().split("\n").filter((l) => l.startsWith("[auth mail]") && l.includes("Your Hyperfocus day"));
beforeAll(async () => {
  api = await startExtraApi("digest", { ...CLOUD, NO_BACKGROUND_JOBS: "" });
  [bob, carol, alice] = await Promise.all([signUp(api, "bob-digest@example.com", "Bob"), signUp(api, "carol-digest@example.com", "Carol"), signUp(api, "alice-digest@example.com", "Alice")]);
}, 120000);
afterAll(async () => { await api?.stop(); });

it("sends the day's unread notifications once, to the person, only when they asked and something is unread", async () => {
  for (const p of [bob, carol]) await p.json("PATCH", "/api/settings", { emailDigest: true, digestAt: "00:00", timeZone: "UTC" });
  for (const p of [bob, carol, alice]) await p.json("POST", "/api/notify/test", {});
  await carol.json("POST", "/api/notifications/read", {});

  for (const end = Date.now() + 60000; Date.now() < end && !digests().length; ) await new Promise((r) => setTimeout(r, 1000));
  await new Promise((r) => setTimeout(r, 20000)); // another round of the jobs: still only one
  const sent = digests();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain("to=bob-digest@example.com");
  expect(sent[0]).toContain("This is how your reminders will look.");
}, 120000);

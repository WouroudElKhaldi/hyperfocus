import { afterAll, beforeAll, expect, it } from "vitest";
import { startExtraApi } from "../support/extra-api.js";
import { CLOUD, signUp } from "../support/people.js";

// P5-11: settings are each person's own (they used to be one settings.json for everyone, so in cloud mode one person's
// change would have changed everybody's).

let api, bob, alice;
beforeAll(async () => {
  api = await startExtraApi("settings_people", CLOUD);
  [bob, alice] = await Promise.all([signUp(api, "bob-settings@example.com", "Bob"), signUp(api, "alice-settings@example.com", "Alice")]);
}, 120000);
afterAll(async () => { await api?.stop(); });

it("one person's settings never change another's", async () => {
  const fresh = await alice.json("GET", "/api/settings");
  expect(fresh).toMatchObject({ reminders: true, breakEveryMin: 50, textSize: "normal" });
  expect(await bob.json("PATCH", "/api/settings", { breakEveryMin: 25, textSize: "larger", reminders: false })).toMatchObject({ breakEveryMin: 25, textSize: "larger", reminders: false });
  expect(await bob.json("GET", "/api/settings")).toMatchObject({ breakEveryMin: 25, textSize: "larger", reminders: false });
  expect(await alice.json("GET", "/api/settings")).toEqual(fresh);
});

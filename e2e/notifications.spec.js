import { expect, test } from "@playwright/test";

// P5-11: the bell at the top lists your notifications with the unread count; quiet hours are set in Settings.

test("a notification shows in the bell, unread, and can be marked read", async ({ page, request }) => {
  await page.goto("/");
  await request.post("/api/notifications/read", { data: {} }); // start with nothing unread
  await request.post("/api/notify/test", { data: {} });
  await page.reload();
  const bell = page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("This is how your reminders will look.").first()).toBeVisible();
  await panel.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("quiet hours are saved, and can be cleared", async ({ page }) => {
  await page.goto("/backup");
  const card = page.locator(".card", { has: page.getByRole("heading", { name: "Where notifications go" }) });
  await card.getByLabel("Quiet hours start").fill("22:00");
  await card.getByLabel("Quiet hours end").fill("07:00");
  await expect(card.getByRole("button", { name: "No quiet hours" })).toBeVisible();
  await page.reload();
  await expect(card.getByLabel("Quiet hours start")).toHaveValue("22:00");
  await expect(card.getByLabel("Quiet hours end")).toHaveValue("07:00");
  await expect(card.getByText(/Times are in your time zone: [A-Za-z_]+\/[A-Za-z_]+/)).toBeVisible(); // taken from this device
  await card.getByRole("button", { name: "No quiet hours" }).click();
  await expect(card.getByLabel("Quiet hours start")).toHaveValue("");
});

// P5-11 part 3: web push on this device. The browser's real push service is on the internet, so its subscription is a
// stand-in here; everything else is real: permission, the service worker (/sw.js), the app's key, the server.
test("turn notifications on and off for this device", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => {
    const make = () => ({
      endpoint: "http://127.0.0.1:9/e2e-device",
      toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U", auth: "tBHItJI5svbpez7KI4CCXg" } }; },
      async unsubscribe() { localStorage.removeItem("e2e-sub"); return true; },
    });
    PushManager.prototype.subscribe = async () => { localStorage.setItem("e2e-sub", "1"); return make(); };
    PushManager.prototype.getSubscription = async () => (localStorage.getItem("e2e-sub") ? make() : null);
  });
  await page.goto("/backup");
  const card = page.locator(".card", { has: page.getByRole("heading", { name: "Where notifications go" }) });
  await expect(card.getByText("Off: reminders only show in the bell while Hyperfocus is open.")).toBeVisible();
  await card.getByRole("button", { name: "Turn on for this device" }).click();
  await expect(card.getByText("On: notifications pop up here even when Hyperfocus is closed.")).toBeVisible();
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration("/sw.js")))).toBe(true);
  expect((await (await page.request.get("/api/settings")).json()).push).toBe(true);
  await page.reload();
  await expect(card.getByText(/^On: notifications pop up here/)).toBeVisible();
  await card.getByRole("button", { name: "Turn off for this device" }).click();
  await expect(card.getByText(/^Off: reminders only show in the bell/)).toBeVisible();
  expect((await (await page.request.get("/api/settings")).json()).push).toBe(false);
});

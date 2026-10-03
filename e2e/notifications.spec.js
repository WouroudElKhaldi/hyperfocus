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

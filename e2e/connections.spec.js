import { expect, test } from "@playwright/test";

// P5-07 (your request): saving your own credentials in Settings → Your connections. A wrong one is explained, a saved one
// shows only which account it is (never the secret), and it can be changed or disconnected.

test("save, see, change and disconnect your own DeepSeek key and Gmail", async ({ page }) => {
  await page.goto("/backup");
  const ai = page.getByRole("region", { name: "AI (DeepSeek)" });
  await expect(ai.getByText("Rewrites, coaching, chat")).toBeVisible();

  // too short: the server says what's wrong, next to the form
  await ai.getByLabel("DeepSeek API key").fill("short");
  await ai.getByRole("button", { name: "Save AI (DeepSeek)" }).click();
  await expect(ai.getByRole("alert")).toContainText("DeepSeek API key");

  await ai.getByLabel("DeepSeek API key").fill("sk-e2e-browser-key-4321");
  await ai.getByRole("button", { name: "Save AI (DeepSeek)" }).click();
  await expect(ai.getByText("Connected: key ending in …4321")).toBeVisible();
  await expect(page.getByText("sk-e2e-browser-key-4321")).toHaveCount(0);
  await expect(ai.getByLabel("DeepSeek API key")).toHaveCount(0); // (the form closes once saved)

  // Gmail: the App Password may have spaces
  const gmail = page.getByRole("region", { name: "Email (Gmail)" });
  await gmail.getByLabel("Gmail address").fill("e2e@gmail.com");
  await gmail.getByLabel("Gmail App Password").fill("abcd efgh ijkl mnop");
  await gmail.getByRole("button", { name: "Save Email (Gmail)" }).click();
  await expect(gmail.getByText("Connected: e2e@gmail.com")).toBeVisible();

  // after a reload it is still there; change opens the form again; disconnect removes it
  await page.reload();
  await expect(ai.getByText("Connected: key ending in …4321")).toBeVisible();
  await ai.getByRole("button", { name: "Change" }).click();
  await expect(ai.getByLabel("DeepSeek API key")).toBeVisible();
  await ai.getByRole("button", { name: "Cancel" }).click();
  await ai.getByRole("button", { name: "Disconnect" }).click();
  await expect(ai.getByLabel("DeepSeek API key")).toBeVisible();
  await gmail.getByRole("button", { name: "Disconnect" }).click();
  await expect(gmail.getByLabel("Gmail address")).toBeVisible();
});

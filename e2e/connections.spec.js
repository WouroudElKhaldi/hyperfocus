import { expect, test } from "@playwright/test";

// P5-07 (your request): saving your own credentials in Settings → Your connections. A wrong one is explained, a saved one
// shows only which account it is (never the secret), and it can be changed or disconnected.

test("save, see, change and disconnect your own DeepSeek key and Gmail", async ({ page }) => {
  await page.goto("/backup#connections");
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

// P5-07c: step-by-step guides for people who aren't in tech, reached from each connection
test("each connection links to its step-by-step guide", async ({ page }) => {
  await page.goto("/backup#connections");
  await page.getByRole("region", { name: "Email (Gmail)" }).getByRole("link", { name: "How do I get this?" }).click();
  await expect(page).toHaveURL(/\/help\/connections#gmail$/);
  await expect(page.getByRole("heading", { name: "How to connect your accounts" })).toBeVisible();
  // one guide at a time (owner, 2026-10-04): the Gmail tab is open, with its steps at a glance first
  await expect(page.getByRole("tab", { name: /Gmail/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "2. Email: send from your own Gmail" })).toBeVisible();
  await expect(page.getByRole("figure", { name: "The steps at a glance" })).toContainText("Open App passwords");
  await expect(page.getByRole("heading", { name: "1. The AI: your DeepSeek API key" })).toHaveCount(0);
  await page.getByRole("tab", { name: /LinkedIn$/ }).first().click();
  for (const h of ["3. LinkedIn posting (your own LinkedIn app)", "Step A: make your LinkedIn app"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
  await expect(page.getByText("Primary Client Secret").first()).toBeVisible();
  await page.getByRole("tab", { name: /n8n/ }).click();
  for (const h of ["4. Or: LinkedIn through your own n8n (optional)", "Step B: the part that receives your posts (Webhook)"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
  await expect(page.getByText("{{ $json.body.text }}")).toBeVisible();
  await page.getByRole("tab", { name: /AI \(DeepSeek\)/ }).click();
  await expect(page).toHaveURL(/#ai$/);
  await page.getByRole("region", { name: "1. The AI: your DeepSeek API key" }).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/backup$/);
});

// P5-09: "Connect LinkedIn" with your own LinkedIn app: save its two codes, then the button appears; the address to give
// LinkedIn is shown; the way back reports under LinkedIn (the full flow with a stand-in LinkedIn is in the API suite)
test("LinkedIn posting: save your own LinkedIn app, then Connect LinkedIn", async ({ page }) => {
  await page.goto("/backup#connections");
  const li = page.getByRole("region", { name: "LinkedIn posting" });
  await expect(li.getByText(/\/api\/integrations\/linkedin\/callback$/)).toBeVisible();
  await expect(li.getByRole("button", { name: "Connect LinkedIn" })).toHaveCount(0); // (no app saved yet)
  await li.getByLabel("LinkedIn app Client ID").fill("x");
  await li.getByLabel("LinkedIn app Client Secret").fill("short");
  await li.getByRole("button", { name: "Save LinkedIn posting" }).click();
  await expect(li.getByRole("alert")).toContainText("Client ID");
  await li.getByLabel("LinkedIn app Client ID").fill("86e2etestapp42");
  await li.getByLabel("LinkedIn app Client Secret").fill("e2e-primary-secret");
  await li.getByRole("button", { name: "Save LinkedIn posting" }).click();
  await expect(li.getByText("App saved: app …pp42")).toBeVisible();
  await expect(page.getByText("e2e-primary-secret")).toHaveCount(0);
  await expect(li.getByRole("button", { name: "Connect LinkedIn" })).toBeVisible();

  await page.goto(`/backup?connect-error=${encodeURIComponent("You didn't allow it, so nothing changed.")}&for=linkedin#connections`);
  await expect(li.getByRole("alert")).toHaveText("You didn't allow it, so nothing changed.");
  await page.goto("/backup?connected=linkedin#connections");
  await expect(page.getByRole("status").filter({ hasText: "LinkedIn connected" })).toBeVisible();
  await li.getByRole("link", { name: "How do I get this?" }).click();
  await expect(page.getByRole("heading", { name: "Step A: make your LinkedIn app" })).toBeVisible();
  await page.goto("/backup#connections");
  await li.getByRole("button", { name: "Disconnect" }).click();
  await expect(li.getByLabel("LinkedIn app Client ID")).toBeVisible();
});

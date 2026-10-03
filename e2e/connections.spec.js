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

// P5-08: "Connect with Google" for Gmail. This test copy has no Google client, so it says how to do without; coming back
// from Google says whether it worked (the full flow with a stand-in Google is tested in the API suite).
test("Connect with Google: explains when it isn't set up, and reports how coming back from Google went", async ({ page }) => {
  await page.goto("/backup");
  const gmail = page.getByRole("region", { name: "Email (Gmail)" });
  await gmail.getByRole("button", { name: "Connect with Google" }).click();
  await expect(gmail.getByRole("alert")).toContainText("Connecting with Google isn't set up for this app");

  await page.goto(`/backup?connect-error=${encodeURIComponent("You didn't allow it, so nothing changed.")}`);
  await expect(gmail.getByRole("alert")).toHaveText("You didn't allow it, so nothing changed.");
  await expect(page).toHaveURL(/\/backup$/);
  await page.goto("/backup?connected=gmail");
  await expect(page.getByRole("status").filter({ hasText: "Gmail connected with Google" })).toBeVisible();
});

// P5-07c: step-by-step guides for people who aren't in tech, reached from each connection
test("each connection links to its step-by-step guide", async ({ page }) => {
  await page.goto("/backup");
  await page.getByRole("region", { name: "Email (Gmail)" }).getByRole("link", { name: "How do I get this?" }).click();
  await expect(page).toHaveURL(/\/help\/connections#gmail$/);
  await expect(page.getByRole("heading", { name: "How to connect your accounts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2. Email: send from your own Gmail" })).toBeInViewport();
  for (const h of ["1. The AI: your DeepSeek API key", "3. LinkedIn posting (through n8n)", "Step B: the part that receives your posts (Webhook)"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
  await expect(page.getByText("{{ $json.body.text }}")).toBeVisible();
  await page.getByText('n8n asks for a Client ID and Client Secret (getting your LinkedIn "id")').click();
  await expect(page.getByText("Primary Client Secret")).toBeVisible();
  await page.getByRole("region", { name: "1. The AI: your DeepSeek API key" }).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/backup$/);
});

// P5-09: "Connect LinkedIn". This test copy has no LinkedIn app, so it says to use n8n; the way back reports under
// LinkedIn (the full flow with a stand-in LinkedIn is in the API suite)
test("Connect LinkedIn: explains when it isn't set up, and reports how coming back from LinkedIn went", async ({ page }) => {
  await page.goto("/backup");
  const li = page.getByRole("region", { name: "LinkedIn posting" });
  await li.getByRole("button", { name: "Connect LinkedIn" }).click();
  await expect(li.getByRole("alert")).toContainText("Connecting LinkedIn directly isn't set up for this app");
  await page.goto(`/backup?connect-error=${encodeURIComponent("You didn't allow it, so nothing changed.")}&for=linkedin`);
  await expect(li.getByRole("alert")).toHaveText("You didn't allow it, so nothing changed.");
  await page.goto("/backup?connected=linkedin");
  await expect(page.getByRole("status").filter({ hasText: "LinkedIn connected" })).toBeVisible();
  await li.getByRole("link", { name: "How do I get this?" }).click();
  await expect(page.getByRole("heading", { name: "The easy way: Connect LinkedIn (1 minute)" })).toBeVisible();
});

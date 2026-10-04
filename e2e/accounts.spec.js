import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

// P5-01 / P5-04: accounts in the browser, in cloud mode (the "cloud" Playwright project and its own test stack).
// Sign up, confirm by the emailed link, sign out and in, a wrong password, and a forgotten password reset by email.
// The account emails go to the cloud test API's log (MAIL_DRY_RUN); the links are read from there.

const mailLog = () => JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "hyperfocus-e2e-cloud.json"), "utf8")).log;
async function emailedLink(to, subject) {
  for (const end = Date.now() + 15000; Date.now() < end; ) {
    const line = fs.readFileSync(mailLog(), "utf8").split("\n").reverse().find((l) => l.startsWith(`[auth mail] to=${to} `) && l.includes(subject));
    const link = line && JSON.parse(line.slice(line.indexOf("text=") + 5)).match(/https?:\/\/\S+/)?.[0];
    if (link) return link;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No "${subject}" email to ${to}`);
}

test.describe("accounts @cloud", () => {
  const email = `e2e-${Date.now()}@example.com`;

  test("sign up, confirm by email, use the app, sign out and in again, reset a forgotten password", async ({ page }) => {
    // signed out: the sign-in page instead of the app
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator(".sidebar")).toHaveCount(0);

    // sign up
    await page.getByRole("link", { name: "Make an account" }).click();
    await page.getByLabel("Full name").fill("Robin Example");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Phone number").fill("+961 70 123 456");
    await page.getByLabel(/^Password/).fill("first-pass-123");
    await page.getByRole("button", { name: "Make my account" }).click();
    await expect(page.getByText(`Check your inbox: we sent a link to ${email}.`)).toBeVisible();

    // the emailed link confirms and signs in: the app, greeting Robin
    await page.goto(await emailedLink(email, "Confirm your email"));
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator("header.topbar")).toContainText("Robin Example");

    // someone new is not an admin (P5-06): no admin link in Settings, and the admin page says so
    await page.goto("/admin");
    await expect(page.getByText("Only admins can open this page.")).toBeVisible();

    // sign out from Settings
    await page.goto("/backup");
    await expect(page.getByText("Signed in as Robin Example")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the admin area" })).toHaveCount(0);
    // the owner's AI key isn't shared (the default): no shared-key line, the AI asks for your own key
    await expect(page.getByTestId("ai-usage")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "AI (DeepSeek)" }).getByLabel("DeepSeek API key")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    // a wrong password, then the right one
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-my-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel("Password").fill("first-pass-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".sidebar")).toBeVisible();

    // forgot the password: reset it by the emailed link, then sign in with the new one
    await page.goto("/backup");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send me the link" }).click();
    await expect(page.getByText(/the link is on its way/)).toBeVisible();
    await page.goto(await emailedLink(email, "Reset your Hyperfocus password"));
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await page.getByLabel(/^New password/).fill("second-pass-456");
    await page.getByRole("button", { name: "Save my new password" }).click();
    await expect(page.getByText("Your password is changed.")).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("second-pass-456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".sidebar")).toBeVisible();
  });
});

// P5-12: the privacy policy can be read before signing up; deleting your account signs you out for good
test.describe("privacy @cloud", () => {
  test("someone new gets the welcome guide: name, major, what to help with, then Job Radar with their jobs (P5-05)", async ({ page }) => {
    const email = `e2e-welcome-${Date.now()}@example.com`;
    await page.goto("/");
    await page.getByRole("link", { name: "Make an account" }).click();
    await page.getByLabel("Full name").fill("Wel Come");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Phone number").fill("+961 70 123 456");
    await page.getByLabel(/^Password/).fill("welcome-pass-123");
    await page.getByRole("button", { name: "Make my account" }).click();
    await page.goto(await emailedLink(email, "Confirm your email"));

    await expect(page.getByRole("heading", { name: "Welcome! What should we call you?" })).toBeVisible();
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveValue("Wel Come");
    await page.getByLabel("Your name").fill("Wel");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "What do you study, or what's your job?" })).toBeVisible();
    await page.getByRole("button", { name: "Computer Science" }).click();
    await expect(page.getByText("Picked: Computer Science")).toBeVisible();
    await page.getByLabel("Your job, or the job you want").fill("software dev");
    await page.getByRole("option", { name: /Software Developers/ }).first().click();
    await expect(page.getByText("Your job: Software Developers")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "What do you want help with?" })).toBeVisible();
    await page.getByLabel(/Finding internships and jobs/).click();
    await expect(page.getByText(/We'll start Job Radar/)).toHaveCount(0); // (Job Radar is for admins while it is tested)
    await page.getByRole("button", { name: "Let's go" }).click();

    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("link", { name: "Job Radar" })).toHaveCount(0);
    await page.goto("/radar");
    await expect(page.getByText("Job Radar is still being tested.")).toBeVisible();
    await expect(page.locator("header.topbar")).toContainText("Wel");
    // the skills their job needs are waiting on the Skills page; one click adds one
    await page.goto("/skills");
    const card = page.getByRole("region", { name: "Skills for Software Developers" });
    await card.getByRole("button", { name: /Python/ }).click();
    await expect(card.getByText("✓ Python")).toBeVisible();
    // once only: Today is their day now
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /What should we call you/ })).toHaveCount(0);
  });

  test("the privacy page opens signed out, and is linked from sign-up", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Make an account" }).click();
    await expect(page.getByRole("link", { name: "privacy" })).toHaveAttribute("href", "/privacy");
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who sees it" })).toBeVisible();
    await expect(page.locator(".sidebar")).toHaveCount(0);
  });

  test("delete my account: asks for DELETE and the password, then it's gone", async ({ page }) => {
    const email = `e2e-delete-${Date.now()}@example.com`;
    await page.goto("/");
    await page.getByRole("link", { name: "Make an account" }).click();
    await page.getByLabel("Full name").fill("Dee Leet");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Phone number").fill("+961 70 123 456");
    await page.getByLabel(/^Password/).fill("delete-me-123");
    await page.getByRole("button", { name: "Make my account" }).click();
    await page.goto(await emailedLink(email, "Confirm your email"));
    await expect(page.locator(".sidebar")).toBeVisible();

    await page.goto("/backup");
    await page.getByRole("button", { name: "Delete my account" }).click();
    const form = page.getByRole("form", { name: "Delete my account" });
    await form.getByLabel("Type DELETE to confirm").fill("DELETE");
    await form.getByLabel("Your password").fill("wrong-password");
    await form.getByRole("button", { name: "Delete everything" }).click();
    await expect(form.getByRole("alert")).toHaveText("That password isn't right.");
    await form.getByLabel("Your password").fill("delete-me-123");
    await form.getByRole("button", { name: "Delete everything" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    // the account no longer exists
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("delete-me-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });
});

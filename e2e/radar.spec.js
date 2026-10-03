import { expect, test } from "@playwright/test";

// Phase 6 (Job Radar) in the browser. The test API imports a small taxonomy at start (Software Developers, Python,
// Computer Science, Beirut…: apps/api/test/support/taxonomy-fixture.js).

// P6-08 + P6-29: a skill on the Skills map linked to a standard skill, with the keyboard only
test("link a skill to a standard skill with the keyboard, and unlink it", async ({ page }) => {
  await page.goto("/skills");
  await page.getByPlaceholder(/Add a skill/).fill("python for data");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = page.locator(".item.skill").filter({ hasText: "python for data" });
  await row.getByRole("button", { name: "🔗 Link to a standard skill" }).click();

  const box = row.getByRole("combobox", { name: "Standard skill for python for data" });
  await expect(box).toBeFocused();
  await box.pressSequentially("pyt", { delay: 30 });
  const list = row.getByRole("listbox", { name: "Standard skill for python for data" });
  await expect(list.getByRole("option", { name: /Python/ })).toBeVisible();
  await expect(box).toHaveAttribute("aria-expanded", "true");
  await box.press("ArrowDown");
  await box.press("ArrowUp");
  await box.press("Enter");

  await expect(row.getByText("Standard skill:")).toContainText("Python");
  await expect(row.getByText("python for data")).toBeVisible(); // your own name stays
  await page.reload();
  await expect(row.getByText("Standard skill:")).toContainText("Python");
  await row.getByRole("button", { name: "Unlink" }).click();
  await expect(row.getByRole("button", { name: "🔗 Link to a standard skill" })).toBeVisible();
});

test("the picker closes with Escape and shows nothing for one letter", async ({ page }) => {
  await page.goto("/skills");
  await page.getByPlaceholder(/Add a skill/).fill("escape check");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const row = page.locator(".item.skill").filter({ hasText: "escape check" });
  await row.getByRole("button", { name: "🔗 Link to a standard skill" }).click();
  const box = row.getByRole("combobox");
  await box.fill("p");
  await page.waitForTimeout(400);
  await expect(row.getByRole("listbox")).toHaveCount(0);
  await box.fill("git");
  await expect(row.getByRole("option", { name: /Git/ })).toBeVisible();
  await box.press("Escape");
  await expect(row.getByRole("listbox")).toHaveCount(0);
  await row.getByRole("button", { name: "Cancel" }).click();
});

// P6-27, P6-28, P6-31: the Radar page. The test API has three sample postings (an intern software job, a nurse job, a
// senior job: apps/api/test/support/radar-fixture.js).
test.describe.serial("Job Radar", () => {
  test("no filter yet: one click on your major finds the jobs it leads to, with why", async ({ page }) => {
    await page.goto("/radar");
    await expect(page.getByRole("heading", { name: "What do you study?" })).toBeVisible();
    await page.getByRole("region", { name: "Technology and data" }).getByRole("button", { name: "Computer Science" }).click();
    await expect(page.getByRole("heading", { name: "Top picks today" })).toBeVisible();
    const card = page.getByRole("article", { name: "Software Engineer Intern" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("list", { name: "Why it fits" })).toContainText("Matches: Software Developers");
    await expect(card).toContainText("Cedar Labs");
    await expect(card).toContainText("via Arbeitnow");
    await expect(card.getByText(/days? left/)).toBeVisible();
    await expect(page.getByRole("article", { name: "Night Nurse" })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Senior Software Engineer" })).toHaveCount(0); // full time, senior: not a student job
    await expect(page.getByRole("region", { name: "Your filters" }).getByText("Computer Science jobs")).toBeVisible(); // the filter it made
  });

  test("read more, save, 👍, then apply: it goes to Job applications", async ({ page }) => {
    await page.goto("/radar");
    const card = page.getByRole("article", { name: "Software Engineer Intern" });
    await card.getByRole("button", { name: "Read more" }).click();
    await expect(card.getByText(/write Python every day/)).toBeVisible();
    await card.getByRole("button", { name: "More like this" }).click();
    await expect(card.getByRole("button", { name: "More like this" })).toHaveAttribute("aria-pressed", "true");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved for later (1)")).toBeVisible();
    await card.getByRole("button", { name: "Apply" }).first().click();
    await expect(page.getByText("Added to your Job applications. Good luck!")).toBeVisible();
    await page.goto("/jobs");
    await expect(page.getByText("Software Engineer Intern").first()).toBeVisible();
  });

  test("build a filter: simple questions, a live estimate, more options; switch it off and delete it", async ({ page }) => {
    await page.goto("/radar");
    await page.getByRole("button", { name: "Add a filter" }).click();
    const form = page.getByRole("form", { name: "Job Radar filter" });
    await form.getByLabel("Name").fill("Nursing");
    const job = form.getByRole("combobox", { name: "Add a job" });
    await job.pressSequentially("nurse", { delay: 30 });
    await form.getByRole("option", { name: /Registered Nurses/ }).click();
    await expect(form.getByRole("list", { name: "Jobs" })).toContainText("Registered Nurses");
    await expect(form.getByRole("status")).toContainText(/≈ \d+ jobs? a week/);
    await form.getByRole("button", { name: "More options" }).click();
    await form.getByLabel("Words to avoid").fill("commission");
    await form.getByRole("button", { name: "Save filter" }).click();
    const row = page.getByRole("listitem").filter({ hasText: "Nursing" });
    await expect(row).toContainText("Registered Nurses");
    await row.getByRole("checkbox", { name: "Nursing on" }).click();
    await expect(row.getByRole("checkbox", { name: "Nursing on" })).not.toBeChecked();
    await row.getByRole("button", { name: "Delete Nursing" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Nursing" })).toHaveCount(0);
  });

  test("Job Radar is in the menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Job Radar" }).first().click();
    await expect(page.getByRole("heading", { name: "Job Radar", exact: true })).toBeVisible();
  });
});

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

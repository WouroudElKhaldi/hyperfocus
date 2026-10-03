import { expect, test } from "@playwright/test";

// P5-06: the admin area. In local mode the owner is the admin: Settings links to it, it shows the services, the people
// and the feature flags, and a flag can be added and switched on. (Someone who isn't an admin: accounts.spec.js.)

test("the owner opens the admin area from Settings and switches a feature on", async ({ page }) => {
  await page.goto("/backup");
  await page.getByRole("link", { name: "Open the admin area" }).click();
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
  await expect(page.getByText("Mode: local")).toBeVisible();
  await expect(page.getByRole("cell", { name: "admin", exact: true }).first()).toBeVisible();

  const key = `e2e-flag-${Date.now()}`;
  await page.getByLabel("New flag").fill(key);
  await page.getByRole("button", { name: "Add and switch on" }).click();
  const box = page.getByRole("checkbox", { name: key });
  await expect(box).toBeChecked();
  await box.click();
  await expect(box).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: key })).not.toBeChecked();
});

test("job sources: see how each one is doing, add a job board, switch it off", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Job sources" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Arbeitnow/ }).first()).toBeVisible();
  const board = `e2eboard${Date.now()}`;
  await page.getByLabel("Board name").fill(board);
  await page.getByRole("button", { name: "Add job board" }).click();
  const row = page.getByRole("row", { name: new RegExp(board) });
  await expect(row.getByText("not checked yet")).toBeVisible();
  await row.getByRole("button", { name: "Switch off" }).click();
  await expect(row.getByText("off")).toBeVisible();
  await expect(row.getByRole("button", { name: "Switch on" })).toBeVisible();
});

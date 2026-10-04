import { expect, test } from "@playwright/test";

// Changes asked for in interview 1 (docs/research/interview-01-owner.md).

test("the Study page names no course or job, and has the focus round (P3-23)", async ({ page }) => {
  await page.goto("/study");
  await expect(page.getByRole("heading", { name: "Study log", level: 1 })).toBeVisible();
  await expect(page.getByText(/SE Square|software engineer/i)).toHaveCount(0);
  const focus = page.getByRole("region", { name: "Focus round" });
  await focus.getByRole("button", { name: "5 min (tiny start)" }).click();
  await expect(focus.getByText("05:00")).toBeVisible();
});

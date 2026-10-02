import { expect, test } from "@playwright/test";

// P3-01: the look of 3 key pages must not change when the styling tools change (Tailwind, shadcn/ui).
// Screenshots against a fresh, empty test database with the clock fixed, in light and dark mode.
// Run on its own: `pnpm test:visual` (and `pnpm test:visual --update-snapshots` to accept a deliberate change).

const PAGES = [["today", "/"], ["tasks", "/tasks"], ["calendar", "/calendar"]];

for (const mode of ["light", "dark"]) {
  for (const [name, path] of PAGES) {
    test(`${name} looks the same (${mode}) @visual`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-10-05T10:00:00"));
      await page.addInitScript((m) => localStorage.setItem("theme", m), mode);
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      // quotes and the music player change on their own, so they are left out of the picture
      await expect(page).toHaveScreenshot(`${name}-${mode}.png`, {
        fullPage: true,
        animations: "disabled",
        mask: [page.locator(".quote, [class*='quote']")],
        maxDiffPixelRatio: 0.002,
      });
    });
  }
}

// P3-15: every pet drawing (each species at every age, both builds, moods, every item, pattern and aura) must stay
// pixel-identical while the pet code moves. /dev/pet exists only in development, which is what the tests run.
test("every pet drawing looks the same @visual", async ({ page }) => {
  await page.goto("/dev/pet");
  // only the drawings: the app around them (greeting, music button) changes with the time of day
  await page.addStyleTag({ content: ".topbar, .music-panel, [class*=\"music\"] { visibility: hidden !important; }" });
  await expect(page.getByRole("heading", { name: "every item (adult cat)" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("pet-gallery")).toHaveScreenshot("pet-gallery.png", { animations: "disabled", maxDiffPixels: 0 });
});

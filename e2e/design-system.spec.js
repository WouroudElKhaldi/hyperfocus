import AxeBuilder from "@axe-core/playwright";
import { test as base, expect } from "@playwright/test";

// P3-02: the design system page (/dev/ui, development only), checked against WCAG 2.2 AA with axe-core in every palette
// and in light and dark, plus what axe can't see: keyboard use, focus, error messages and reduced motion.

const test = base.extend({
  // console errors a test expects on purpose (like the browser logging a refused request)
  allowedConsoleErrors: [[], { option: true }],
  page: async ({ page, allowedConsoleErrors }, use) => {
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await use(page);
    expect(errors.filter((e) => !allowedConsoleErrors.some((re) => re.test(e))), "console errors on the page").toEqual([]);
  },
});

const PALETTES = ["lavender", "rose", "peach", "mint", "sky", "lagoon", "midnight", "forest", "crimson", "copper", "amber", "steel", "graphite"];
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function open(page, { mode = "light", palette = "lavender" } = {}) {
  await page.addInitScript(([m, p]) => { localStorage.setItem("theme", m); localStorage.setItem("palette", p); }, [mode, palette]);
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // the page fades in; measure colors only once it is fully visible
  // (endless ones, like the music button's equaliser, are ignored)
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== "running" || x.effect?.getTiming().iterations === Number.POSITIVE_INFINITY));
}

test.describe("design system: WCAG 2.2 AA (axe)", () => {
  for (const mode of ["light", "dark"]) {
    for (const palette of PALETTES) {
      test(`${palette}, ${mode}`, async ({ page }) => {
        await open(page, { mode, palette });
        const { violations } = await new AxeBuilder({ page }).include("main").withTags(WCAG).analyze();
        const summary = violations.map((v) => `${v.id}: ${v.nodes.length}× (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`);
        expect(summary).toEqual([]);
      });
    }
  }

  test("an open dialog passes too", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Plan a study block" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).include("[role=dialog]").withTags(WCAG).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe("design system: keyboard, focus and motion", () => {
  test("the dialog works with the keyboard: Enter opens, focus stays inside, Esc closes and returns focus", async ({ page }) => {
    await open(page);
    const trigger = page.getByRole("button", { name: "Plan a study block" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Plan a study block" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), "focus stays in the dialog").toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a keyboard focus ring is clearly visible on buttons and fields", async ({ page }) => {
    await open(page);
    for (const el of [page.getByRole("button", { name: "Primary", exact: true }), page.getByRole("textbox", { name: "Task" })]) {
      await el.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(el).toBeFocused();
      const outline = await el.evaluate((e) => { const s = getComputedStyle(e); return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) }; });
      expect(outline.style).toBe("solid");
      expect(outline.width).toBeGreaterThanOrEqual(2);
    }
  });

  test("a form error is announced and tied to its field", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Save" }).click();
    const field = page.getByRole("textbox", { name: "Task" });
    const error = page.locator("#ui-name-error");
    await expect(error).toHaveText("Give the task a name, even a messy one.");
    await expect(error).toHaveAttribute("role", "alert"); // announced by screen readers as soon as it appears
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute("aria-describedby", "ui-name-error");
    await field.fill("Open the slides");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved “Open the slides”. One thing at a time.")).toBeVisible();
  });

  test("with reduced motion, nothing animates", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await page.getByRole("button", { name: "Plan a study block" }).click();
    const duration = await page.getByRole("dialog").evaluate((d) => getComputedStyle(d).animationDuration);
    expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.01);
  });
});

// P3-03: reading and changing data through TanStack Query, with an optimistic change that is undone on failure.
test.describe("design system: data (TanStack Query)", () => {
  test("a new thought shows at once, then is really saved", async ({ page }) => {
    await open(page);
    const text = `Optimistic ${Date.now()}`;
    await page.getByLabel("A thought").fill(text);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("list", { name: "Latest thoughts" }).getByText(text)).toBeVisible();
    await expect.poll(async () => (await (await page.request.get("/api/notes")).json()).some((n) => n.body === text)).toBe(true);
  });

  test.describe("when the server refuses", () => {
    test.use({ allowedConsoleErrors: [/status of 500/] });
    test("the thought shows at once, then is taken out again with a message", async ({ page }) => {
      await open(page);
      await page.route("**/api/notes", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await new Promise((r) => setTimeout(r, 800)); // long enough to see the optimistic row
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "The notes couldn't be saved just now." }) });
      });
      const text = `Refused ${Date.now()}`;
      await page.getByLabel("A thought").fill(text);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      const row = page.getByRole("list", { name: "Latest thoughts" }).getByText(text);
      await expect(row).toBeVisible(); // optimistic
      await expect(row).toContainText("saving");
      await expect(page.getByText("The notes couldn't be saved just now.")).toBeVisible(); // the error toast
      await expect(row).toBeHidden(); // undone
    });
  });
});

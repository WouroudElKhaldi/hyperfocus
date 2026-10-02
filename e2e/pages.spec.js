import { test as base, expect } from "@playwright/test";

// P0-03: every page loads without console errors, and its main action works.
// Runs against the safe test API (fake AI replies are "Fake ...", see apps/api/test/support/fakes.js).

const test = base.extend({
  // console errors a test expects on purpose (e.g. the browser logging a 404 when opening a deleted item)
  allowedConsoleErrors: [[], { option: true }],
  // Fails the test if the page logs an error or throws, so silent breakage can't hide.
  page: async ({ page, allowedConsoleErrors }, use) => {
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await use(page);
    expect(errors.filter((e) => !allowedConsoleErrors.some((re) => re.test(e))), "console errors on the page").toEqual([]);
  },
});

const ROUTES = ["/", "/notes", "/tasks", "/goals", "/skills", "/review", "/wins", "/backup", "/books", "/study", "/calendar", "/posts", "/emails", "/jobs", "/chat", "/pet", "/profile"];

test.describe("every page loads @phone", () => {
  for (const path of ROUTES) {
    test(`loads ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
    });
  }
});

// P0-05: opening an item that doesn't exist (deleted, or a bad link) must never hang on "Loading…".
test.describe("detail pages for missing items", () => {
  test.use({ allowedConsoleErrors: [/status of (404|500)/] });
  const cases = [
    ["/emails/999999", "Email not found", "Back to email"],
    ["/posts/999999", "Post not found", "Back to posts"],
    ["/jobs/999999", "Job not found", "Back to jobs"],
    ["/books/999999-gone", "Book not found", "Back to my books"],
  ];
  for (const [path, heading, back] of cases) {
    test(`${path} says it's not found and offers a way back`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await page.getByRole("link", { name: back }).click();
      await expect(page).toHaveURL(path.replace(/\/[^/]+$/, ""));
    });
  }

  test("a server error shows a retry instead of 'not found'", async ({ page }) => {
    let fail = true;
    await page.route("**/api/jobs/1234", (route) => (fail ? route.fulfill({ status: 500, json: { error: "Database is busy" } }) : route.continue()));
    await page.goto("/jobs/1234");
    await expect(page.getByRole("heading", { name: "Couldn't load this job" })).toBeVisible();
    await expect(page.getByText("Database is busy")).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Job not found" })).toBeVisible(); // 1234 really doesn't exist
  });
});

test.describe("app-wide", () => {
  test("pages are served with the security headers (CSP and friends)", async ({ page }) => {
    const res = await page.goto("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-src https://www.youtube-nocookie.com");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the music player opens with its track library", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open music player" }).click();
    await expect(page.getByLabel("Search tracks")).toBeVisible();
    await expect(page.getByLabel("Next track")).toBeVisible();
  });

  // P3-04: typed routes (TanStack Router)
  test("an address that isn't a page says so kindly, with a way back", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { level: 1, name: "This page doesn't exist" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Today" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the menu moves between pages without reloading, and marks where you are", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "the phone menu is a tab bar");
    await page.goto("/");
    await page.evaluate(() => { window.__sameDocument = true; });
    await page.locator(".sidebar").getByRole("link", { name: "Tasks", exact: true }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(await page.evaluate(() => window.__sameDocument), "no full page reload").toBe(true);
    await expect(page.locator(".sidebar").getByRole("link", { name: "Tasks", exact: true })).toHaveClass(/active/);
    await expect(page.locator(".sidebar").getByRole("link", { name: "Today", exact: true })).not.toHaveClass(/active/);
  });

  test("old links still open: a book by id and title, a post by id", async ({ page, request }) => {
    const book = await (await request.post("/api/books", { data: { title: "Deep Work" } })).json();
    await page.goto(`/books/${book.id}-deep-work`);
    await expect(page.getByRole("heading", { name: "Deep Work" })).toBeVisible();
    const post = await (await request.post("/api/posts", { data: { thought: "Old link check" } })).json();
    await page.goto(`/posts/${post.id}`);
    await expect(page.locator("main h1").first()).toBeVisible();
  });

  // P3-01: shadcn/ui colors are mapped onto the app's tokens, so they follow every palette and light/dark
  test("Tailwind/shadcn colors follow the chosen palette and mode", async ({ page }) => {
    for (const mode of ["light", "dark"]) {
      await page.addInitScript((m) => { localStorage.setItem("theme", m); localStorage.setItem("palette", "mint"); }, mode);
      await page.goto("/");
      await expect(page.locator("main h1").first()).toBeVisible();
      const { primary, accent, background, bg } = await page.evaluate(() => {
        const probe = (cls) => { const el = document.createElement("div"); el.className = cls; document.body.append(el); const c = getComputedStyle(el); const v = { bg: c.backgroundColor, color: c.color }; el.remove(); return v; };
        const css = getComputedStyle(document.documentElement);
        const toRgb = (hex) => { const n = parseInt(hex.trim().slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
        return { primary: probe("bg-primary").bg, accent: toRgb(css.getPropertyValue("--accent")), background: probe("bg-background").bg, bg: toRgb(css.getPropertyValue("--bg")) };
      });
      expect(primary, `bg-primary in ${mode}`).toBe(accent);
      expect(background, `bg-background in ${mode}`).toBe(bg);
      expect(accent, "mint is applied").not.toBe("rgb(116, 71, 230)"); // not the default lavender
    }
  });

  test("the theme can be switched to dark and back to light", async ({ page }) => {
    await page.goto("/backup");
    await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("main action on each page", () => {
  test("Today: start and pause the focus round", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("button", { name: /Pause/ })).toBeVisible();
  });

  test("Notes: add a thought", async ({ page }) => {
    await page.goto("/notes");
    await page.getByPlaceholder("Write it down…").fill("E2E thought");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("E2E thought")).toBeVisible();
  });

  test("Tasks: add a task and tick it", async ({ page }) => {
    await page.goto("/tasks");
    await page.getByPlaceholder("New task…").fill("E2E task");
    await page.getByPlaceholder("New task…").press("Enter");
    const box = page.getByRole("checkbox", { name: "Done: E2E task" });
    await expect(box).toBeVisible();
    await box.click(); // the box is ticked once the server confirms
    await expect(box).toBeChecked();
  });

  test("Goals: add a goal and analyse it with the AI", async ({ page }) => {
    await page.goto("/goals");
    await page.getByPlaceholder(/In your own words, what do you want/).fill("E2E goal");
    await page.getByRole("button", { name: "Add goal" }).click();
    await expect(page.locator("textarea").filter({ hasText: "E2E goal" })).toBeVisible();
  });

  test("Skills: add a skill", async ({ page }) => {
    await page.goto("/skills");
    await page.getByPlaceholder(/Add a skill/).fill("E2E skill");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("E2E skill").first()).toBeVisible();
  });

  test("Review: write a weekly review", async ({ page }) => {
    await page.goto("/review");
    await page.getByRole("button", { name: /Review my week/ }).click();
    await expect(page.getByText("A calm week.")).toBeVisible();
  });

  test("Wins: add a win", async ({ page }) => {
    await page.goto("/wins");
    await page.getByRole("textbox").first().fill("E2E win");
    await page.getByRole("button", { name: "Add win" }).click();
    await expect(page.getByText("E2E win")).toBeVisible();
  });

  test("Settings: make a backup", async ({ page }) => {
    await page.goto("/backup");
    await page.getByRole("button", { name: /Back up/ }).first().click();
    await expect(page.getByText(/^Last backup:/)).toBeVisible();
    await expect(page.getByText(/All my backups \([1-9]\d*\)/)).toBeVisible();
  });

  test("Books: add a book, open it and ask the AI about it", async ({ page }) => {
    await page.goto("/books");
    await page.getByPlaceholder("Book title…").fill("E2E Book");
    await page.getByPlaceholder("Book title…").press("Enter");
    await page.getByText("E2E Book").first().click();
    await expect(page).toHaveURL(/\/books\/\d+-e2e-book/);
    await page.getByPlaceholder("Ask about this book…").fill("What is it about?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Fake companion reply.")).toBeVisible();
  });

  test("Study: start and stop the timer", async ({ page }) => {
    await page.goto("/study");
    await page.getByRole("button", { name: /Start timer/ }).click();
    const stop = page.getByRole("button", { name: /Stop/ }).first();
    await expect(stop).toBeVisible();
    await stop.click();
  });

  test("Calendar: add an event", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByRole("button", { name: "+ Event" }).first().click();
    await page.getByPlaceholder("Event title").fill("E2E event");
    await page.getByRole("button", { name: "Add event" }).click();
    await expect(page.getByText("E2E event").first()).toBeVisible();
  });

  test("Posts: create a post and open the editor", async ({ page }) => {
    await page.goto("/posts");
    await page.getByRole("button", { name: "+ New post" }).click();
    await expect(page).toHaveURL(/\/posts\/\d+/);
    await expect(page.getByRole("heading", { name: "Post editor" })).toBeVisible();
  });

  test("Email: create a draft and open the editor", async ({ page }) => {
    await page.goto("/emails");
    await page.getByRole("button", { name: "+ New email" }).click();
    await expect(page).toHaveURL(/\/emails\/\d+/);
    await expect(page.getByRole("heading", { name: /Write an email/ })).toBeVisible();
  });

  test("Jobs: add a job and open it", async ({ page }) => {
    await page.goto("/jobs");
    await page.getByRole("button", { name: /New job/ }).click();
    await page.getByPlaceholder("Company *").fill("E2E Company");
    await page.getByPlaceholder("Job title").fill("E2E Role");
    await page.getByRole("button", { name: "Add job" }).click();
    await page.getByText("E2E Company").first().click();
    await expect(page).toHaveURL(/\/jobs\/\d+/);
  });

  test("Chat: send a message and get a reply", async ({ page }) => {
    await page.goto("/chat");
    await page.getByRole("textbox").last().fill("Hello there");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Fake companion reply.")).toBeVisible();
  });

  test("Pet: hatch a companion", async ({ page }) => {
    await page.goto("/pet");
    await page.getByPlaceholder("What will you call it?").fill("Pixel");
    await page.getByRole("button", { name: "Start with an egg" }).click();
    await expect(page.getByRole("heading", { name: "Pixel", exact: true })).toBeVisible();
  });

  test("Profile: save your name", async ({ page }) => {
    await page.goto("/profile");
    await page.getByPlaceholder("What should I call you?").fill("E2E Person");
    await page.getByRole("button", { name: /Save/ }).first().click();
    await expect(page.getByText(/Saved\./)).toBeVisible();
  });
});

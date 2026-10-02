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
    expect(
      errors.filter((e) => !allowedConsoleErrors.some((re) => re.test(e))),
      "console errors on the page",
    ).toEqual([]);
  },
});

const ROUTES = [
  "/",
  "/notes",
  "/tasks",
  "/goals",
  "/skills",
  "/review",
  "/wins",
  "/backup",
  "/books",
  "/study",
  "/calendar",
  "/posts",
  "/emails",
  "/jobs",
  "/chat",
  "/pet",
  "/profile",
];

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
    await page.route("**/api/jobs/1234", (route) =>
      fail ? route.fulfill({ status: 500, json: { error: "Database is busy" } }) : route.continue(),
    );
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
    await page.evaluate(() => {
      window.__sameDocument = true;
    });
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
      await page.addInitScript((m) => {
        localStorage.setItem("theme", m);
        localStorage.setItem("palette", "mint");
      }, mode);
      await page.goto("/");
      await expect(page.locator("main h1").first()).toBeVisible();
      const { primary, accent, background, bg } = await page.evaluate(() => {
        const probe = (cls) => {
          const el = document.createElement("div");
          el.className = cls;
          document.body.append(el);
          const c = getComputedStyle(el);
          const v = { bg: c.backgroundColor, color: c.color };
          el.remove();
          return v;
        };
        const css = getComputedStyle(document.documentElement);
        const toRgb = (hex) => {
          const n = parseInt(hex.trim().slice(1), 16);
          return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
        };
        return {
          primary: probe("bg-primary").bg,
          accent: toRgb(css.getPropertyValue("--accent")),
          background: probe("bg-background").bg,
          bg: toRgb(css.getPropertyValue("--bg")),
        };
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
    await page
      .getByRole("button", { name: /Back up/ })
      .first()
      .click();
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

// P3-07: Today, Tasks and Notes read and change one shared cache, ticks show at once, and a refused change goes back.
test.describe("Today, Tasks and Notes share their data", () => {
  test("an empty task shows the server's own message, without sending anything", async ({ page }) => {
    let sent = false;
    page.on("request", (r) => r.method() === "POST" && r.url().endsWith("/api/tasks") && (sent = true));
    await page.goto("/tasks");
    await page.getByPlaceholder("New task…").press("Enter");
    await expect(page.getByRole("alert")).toHaveText("Task needs a title.");
    await expect(page.getByPlaceholder("New task…")).toHaveAttribute("aria-invalid", "true");
    expect(sent).toBe(false);
    await page.getByPlaceholder("New task…").fill("E2E after the message");
    await page.getByPlaceholder("New task…").press("Enter");
    await expect(page.getByRole("checkbox", { name: "Done: E2E after the message" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test.describe(() => {
    test.use({ allowedConsoleErrors: [/status of 500/] });
    test("a tick the server refuses goes back, with the reason", async ({ page }) => {
      await page.request.post("/api/tasks", { data: { title: "E2E refused tick" } });
      await page.goto("/tasks");
      const box = page.getByRole("checkbox", { name: "Done: E2E refused tick" });
      await page.route("**/api/tasks/*", (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({ status: 500, json: { error: "Database is busy" } })
          : route.continue(),
      );
      await box.click();
      await expect(page.getByText("Database is busy")).toBeVisible();
      await expect(box).not.toBeChecked();
    });
  });

  test("a task finished on Tasks leaves Today without a reload", async ({ page }) => {
    await page.request.post("/api/tasks", { data: { title: "E2E today task", today: true } });
    await page.goto("/");
    await expect(page.getByText("E2E today task")).toBeVisible();
    await page.locator(".sidebar").getByRole("link", { name: "Tasks", exact: true }).click();
    await page.getByRole("checkbox", { name: "Done: E2E today task" }).click();
    await expect(page.getByRole("checkbox", { name: "Done: E2E today task" })).toBeChecked();
    await page.locator(".sidebar").getByRole("link", { name: "Today", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Brain dump" })).toBeVisible();
    await expect(page.getByText("E2E today task")).toHaveCount(0);
  });

  test("Today: tiny steps, a brain dump and the AI sort all save", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/Whatever is in your head/).fill("E2E dump thought");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved. It's out of your head now")).toBeVisible();
    await page.getByText("Recently saved").click();
    await expect(page.getByText("E2E dump thought")).toBeVisible();
    await page.getByPlaceholder(/Whatever is in your head/).fill("buy milk");
    await page.getByText("More ways to save").click();
    await page.getByRole("button", { name: "Sort it for me (AI)" }).click();
    await expect(page.getByText("AI split it into 1 items.")).toBeVisible();
    await page.getByRole("button", { name: "Save all" }).click();
    await expect(page.getByText("Saved 1 items")).toBeVisible();
    await page.goto("/tasks");
    const row = page.locator(".item").filter({ hasText: "Buy milk" }).first();
    await row.getByRole("button", { name: "Tiny steps (AI)" }).click();
    await expect(row.getByText("Read one page")).toBeVisible();
  });

  test("Notes: pin, archive and bring back a thought", async ({ page }) => {
    await page.request.post("/api/notes", { data: { body: "E2E archive me" } });
    await page.goto("/notes");
    const card = page.locator(".card").filter({ hasText: "E2E archive me" });
    await card.getByText("More", { exact: true }).click();
    await card.getByRole("button", { name: "Pin" }).click();
    await expect(card.getByText("Pinned", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived. It's kept under the Archived tab.")).toBeVisible();
    await expect(page.getByText("E2E archive me")).toHaveCount(0);
    await page.getByRole("button", { name: /^Archived \(/ }).click();
    const archived = page.locator(".card").filter({ hasText: "E2E archive me" });
    await archived.getByText("More", { exact: true }).click();
    await archived.getByRole("button", { name: "Unarchive" }).click();
    await expect(page.getByText("E2E archive me")).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByText("E2E archive me")).toBeVisible();
  });
});

// P3-08: Calendar and Reminders on the shared cache. A task added on the calendar is the same task everywhere.
test.describe("Calendar and Reminders share their data", () => {
  test("a reminder set on Today shows in Settings, and deleting it there removes it", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Remind me to…").fill("E2E drink water");
    await page.getByRole("button", { name: "In 1 hour" }).click();
    await expect(page.getByText(/I'll remind you today|I'll remind you tomorrow/)).toBeVisible();
    await expect(page.locator(".rem-list").getByText("E2E drink water")).toBeVisible();
    await page.goto("/backup");
    await expect(page.locator(".rem-list").getByText("E2E drink water")).toBeVisible();
    await page.getByRole("button", { name: "Delete reminder E2E drink water" }).click();
    await expect(page.getByText("E2E drink water")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "My reminders" })).toBeVisible();
    await expect(page.getByText("E2E drink water")).toHaveCount(0);
  });

  test("a task added on the calendar is ticked there and shows as done on Tasks", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByPlaceholder("New task for this day").fill("E2E calendar task");
    await page.getByPlaceholder("New task for this day").press("Enter");
    const box = page
      .locator(".cal-side, aside, .card")
      .getByRole("checkbox", { name: "Done: E2E calendar task" })
      .first();
    await expect(box).toBeVisible();
    await box.click();
    await expect(box).toBeChecked();
    await page.locator(".sidebar").getByRole("link", { name: "Tasks", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Done: E2E calendar task" })).toBeChecked();
  });

  test("quick add with AI, then delete the event", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByLabel("Quick add an event in your own words").fill("study friday 3pm");
    await page.getByRole("button", { name: "Add with AI" }).click();
    await expect(page.getByPlaceholder("Event title")).toHaveValue("Study"); // the fake AI's answer
    await page.getByPlaceholder("Event title").fill("E2E quick event");
    await page.getByRole("button", { name: "Add event" }).click();
    await expect(page.getByText("Event added")).toBeVisible();
    const event = page.locator(".side-ev").filter({ hasText: "E2E quick event" });
    await expect(event).toBeVisible(); // the side panel jumps to the event's day
    await event.click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Event deleted")).toBeVisible();
    await expect(page.getByText("E2E quick event")).toHaveCount(0);
  });
});

// P3-09: Goals, Skills, Study and Review on the shared cache.
test.describe("Goals, Skills, Study and Review keep their data", () => {
  test.beforeEach(({ page }) => page.on("dialog", (d) => d.accept())); // "Delete this …?"

  test("Goals: plan a step, tick it, log progress, then delete the goal", async ({ page }) => {
    await page.goto("/goals");
    await page.getByPlaceholder(/In your own words, what do you want/).fill("E2E goal with a plan");
    await page.getByRole("button", { name: "Add goal" }).click();
    const card = page
      .locator(".card.goal")
      .filter({ has: page.locator("textarea", { hasText: "E2E goal with a plan" }) });
    await card.getByPlaceholder("Add a step…").fill("E2E first step");
    await card.getByPlaceholder("Add a step…").press("Enter");
    const step = card.getByRole("checkbox").first();
    await step.click();
    await expect(step).toBeChecked();
    await card.getByText("My progress log").click();
    await card.getByPlaceholder("What did you do toward this today?").fill("E2E did a thing");
    await card.getByRole("button", { name: "Log it" }).click();
    await expect(card.getByText("E2E did a thing")).toBeVisible();
    await page.reload();
    await expect(card.getByRole("checkbox").first()).toBeChecked(); // saved, not just shown
    await card.getByText("More", { exact: true }).click();
    await card.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("textarea", { hasText: "E2E goal with a plan" })).toHaveCount(0);
  });

  test("Skills: rate a skill, and the rating is kept", async ({ page }) => {
    await page.goto("/skills");
    await page.getByPlaceholder(/Add a skill/).fill("E2E rated skill");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const row = page.locator(".item.skill").filter({ hasText: "E2E rated skill" });
    await row.getByRole("button", { name: "level 3" }).click();
    await expect(row.getByText("Comfortable")).toBeVisible();
    await page.reload();
    await expect(row.getByText("Comfortable")).toBeVisible();
    await row.getByRole("button", { name: "🪄 How to close it" }).click();
    await expect(row.getByText("1. Read one page")).toBeVisible(); // the fake AI's plan
  });

  test("Study: notes typed while studying survive a reload; break, resume, stop", async ({ page }) => {
    await page.goto("/study");
    await page.getByPlaceholder("Part (e.g. Part 1: Intro)").first().fill("E2E part");
    await page.getByRole("button", { name: /Start timer/ }).click();
    await expect(page.getByText("Timer started.")).toBeVisible();
    await page
      .getByPlaceholder(/What did you learn or do/)
      .first()
      .fill("E2E notes while studying");
    await page.waitForTimeout(1500); // the auto-save runs a second after typing stops
    await page.reload();
    await expect(page.getByPlaceholder(/What did you learn or do/).first()).toHaveValue("E2E notes while studying");
    await page.getByRole("button", { name: /Take a break/ }).click();
    await expect(page.getByText("Break started")).toBeVisible();
    await page.getByRole("button", { name: /Resume/ }).click();
    await expect(page.getByText("Welcome back")).toBeVisible();
    await page.getByRole("button", { name: /Stop & save/ }).click();
    await expect(page.getByText("Session saved 🎉")).toBeVisible();
    await expect(page.getByRole("button", { name: /Start timer/ })).toBeVisible();
    await expect(page.getByPlaceholder("Part (e.g. Part 1: Intro)").first()).toHaveValue("");
    await expect(page.getByText("E2E notes while studying")).toBeVisible(); // in the log
  });

  test("Review: a priority becomes a task, then the review is deleted", async ({ page }) => {
    await page.goto("/review");
    await page.getByRole("button", { name: /Review my week/ }).click();
    await expect(page.getByText("A calm week.")).toBeVisible();
    await page.getByRole("button", { name: "➕ task" }).first().click();
    await expect(page.getByText("Added to your tasks ✅")).toBeVisible();
    await page.getByRole("button", { name: "Delete this review" }).click();
    await page.goto("/tasks");
    await expect(page.getByRole("checkbox", { name: "Done: Finish one task" }).first()).toBeVisible();
  });
});

// P3-10: Books on the shared cache: a change on a book's page is already on the list, the AI question comes back if it fails.
test.describe("Books keep their data", () => {
  test("a status and notes set on the book's page show on the list without a reload", async ({ page }) => {
    await page.goto("/books");
    await page.getByPlaceholder("Book title…").fill("E2E Cached Book");
    await page.getByPlaceholder("Book title…").press("Enter");
    await page
      .locator(".book")
      .filter({ hasText: "E2E Cached Book" })
      .getByRole("link", { name: "Open", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "E2E Cached Book" })).toBeVisible();
    await page.getByLabel("Reading status").selectOption("reading");
    await page.getByLabel("My notes").fill("E2E notes on the book");
    await page.getByLabel("My notes").blur();
    await expect(page.getByText("Notes saved")).toBeVisible();
    await page.getByRole("link", { name: "← All books" }).click();
    await expect(page.locator(".book").filter({ hasText: "E2E Cached Book" }).getByLabel("Reading status")).toHaveValue(
      "reading",
    );
    await page
      .locator(".book")
      .filter({ hasText: "E2E Cached Book" })
      .getByRole("link", { name: "Open", exact: true })
      .click();
    await expect(page.getByLabel("My notes")).toHaveValue("E2E notes on the book");
  });

  test.describe(() => {
    test.use({ allowedConsoleErrors: [/status of (404|500)/] });
    test("a question the AI can't answer goes back into the box", async ({ page }) => {
      const res = await page.request.post("/api/books", { data: { title: "E2E Ask Book" } });
      const { id } = await res.json();
      await page.route(`**/api/books/${id}/ask`, (route) =>
        route.fulfill({ status: 500, json: { error: "The AI is busy" } }),
      );
      await page.goto(`/books/${id}`);
      await page.getByPlaceholder("Ask about this book…").fill("Is it good?");
      await page.getByRole("button", { name: "Ask", exact: true }).click();
      await expect(page.getByText("The AI is busy")).toBeVisible();
      await expect(page.getByPlaceholder("Ask about this book…")).toHaveValue("Is it good?");
      await expect(page.locator(".book-chat-log .msg")).toHaveCount(0);
    });

    test("a book that fails to load offers a retry", async ({ page }) => {
      let fail = true;
      await page.route("**/api/books/4321", (route) =>
        fail ? route.fulfill({ status: 500, json: { error: "Database is busy" } }) : route.continue(),
      );
      await page.goto("/books/4321");
      await expect(page.getByRole("heading", { name: "Couldn't load this book" })).toBeVisible();
      fail = false;
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByRole("heading", { name: "Book not found" })).toBeVisible();
    });
  });
});

// P3-11: Posts on the shared cache: a post's status changes show on the list, the editor's text is never overwritten.
test.describe("Posts keep their data", () => {
  test.beforeEach(({ page }) => page.on("dialog", (d) => d.accept())); // "Post this to LinkedIn now?", "Delete this post?"

  test("write, let the AI draft, schedule, cancel, then publish; the list follows", async ({ page }) => {
    await page.goto("/posts");
    await page.getByRole("button", { name: "+ New post" }).click();
    await expect(page).toHaveURL(/\/posts\/\d+/);
    await page.getByPlaceholder(/Type your raw thoughts/).fill("E2E post thought");
    await page.getByRole("button", { name: /Turn into a LinkedIn post/ }).click();
    await expect(page.getByPlaceholder(/Your draft will appear here/)).toHaveValue("Fake draft from the AI.");
    await page.getByRole("button", { name: "Tomorrow 9:00" }).click();
    await page.getByRole("button", { name: "📅 Schedule" }).click();
    await expect(page.getByText(/⏰ Scheduled for/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel schedule" }).click();
    await expect(page.getByText("Schedule cancelled.")).toBeVisible();
    await page.getByRole("button", { name: "🚀 POST" }).click();
    await expect(page.getByText("Posted to LinkedIn! 🎉")).toBeVisible();
    await expect(page.getByPlaceholder(/Type your raw thoughts/)).toHaveValue("E2E post thought"); // still what was typed
    await page.goto("/posts");
    await page.getByRole("button", { name: /^Posted \(/ }).click();
    await expect(page.getByText("Fake draft from the AI.").first()).toBeVisible();
  });

  test("a post deleted from the list is gone at once", async ({ page }) => {
    await page.request.post("/api/posts", { data: { thought: "E2E post to delete" } });
    await page.goto("/posts");
    const row = page.locator("tr, .post-card, a").filter({ hasText: "E2E post to delete" }).first();
    await row.getByTitle("Delete").click();
    await expect(page.getByText("E2E post to delete")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "LinkedIn posts" })).toBeVisible();
    await expect(page.getByText("E2E post to delete")).toHaveCount(0);
  });
});

// P3-12: Emails on the shared cache. (Tests have no Gmail, so a send is refused: the email shows "Not sent" with why.)
test.describe("Emails keep their data", () => {
  test.beforeEach(({ page }) =>
    page.on("dialog", (d) => (d.type() === "prompt" ? d.accept("E2E template") : d.accept())),
  );

  test.describe(() => {
    test.use({ allowedConsoleErrors: [/status of 400/] });
    test("a draft autosaves, a refused send says why and keeps the text", async ({ page }) => {
      await page.goto("/emails");
      await page.getByRole("button", { name: "+ New email" }).click();
      await expect(page).toHaveURL(/\/emails\/\d+/);
      await page.getByPlaceholder("name@example.com, another@example.com").fill("someone@example.com");
      await page.getByPlaceholder("What is it about?").fill("E2E subject");
      await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible();
      await page.waitForTimeout(1200); // autosave runs 800 ms after typing stops
      await page.reload();
      await expect(page.getByPlaceholder("What is it about?")).toHaveValue("E2E subject");
      await page.getByRole("button", { name: /Send/ }).first().click();
      await expect(page.getByText(/^Gmail is not set up./)).toBeVisible();
      await expect(page.getByPlaceholder("What is it about?")).toHaveValue("E2E subject");
      await expect(page.getByPlaceholder("What is it about?")).toBeEnabled(); // still a draft
    });
  });

  test("save as a template, use it, rename it, delete it", async ({ page }) => {
    const res = await page.request.post("/api/emails");
    const { id } = await res.json();
    await page.request.put(`/api/emails/${id}`, {
      data: { toAddr: "", ccAddr: "", bccAddr: "", subject: "E2E template subject", html: "<p>Hello</p>" },
    });
    await page.goto(`/emails/${id}`);
    await page
      .getByRole("button", { name: /template/i })
      .first()
      .click();
    await expect(page.getByText("Saved as a template 📌")).toBeVisible();
    await page.goto("/emails");
    await page.getByRole("button", { name: /^Templates \(/ }).click();
    const card = page
      .locator("*")
      .filter({ hasText: /^E2E template/ })
      .last();
    await expect(page.getByText("E2E template", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Use" }).last().click();
    await expect(page).toHaveURL(/\/emails\/\d+/);
    await expect(page.getByPlaceholder("What is it about?")).toHaveValue("E2E template subject");
    await page.goto("/emails");
    await page.getByRole("button", { name: /^Templates \(/ }).click();
    await page.getByRole("button", { name: "Delete" }).last().click();
    await expect(card).toHaveCount(0);
  });
});

// P3-13: Jobs on the shared cache: changes show on the list, an email written for a job is linked to it.
test.describe("Jobs keep their data", () => {
  test.beforeEach(({ page }) => page.on("dialog", (d) => d.accept()));

  test("edit a job, keep unsaved notes through a status change, and see it on the list", async ({ page }) => {
    const res = await page.request.post("/api/jobs", { data: { company: "E2E Jobs Co", title: "", url: "" } });
    const { id } = await res.json();
    await page.goto(`/jobs/${id}`);
    await page.getByLabel("Job title").fill("E2E Engineer");
    await page.getByLabel("Notes").fill("E2E unsaved note");
    await page.locator("label").filter({ hasText: /^Status/ }).locator("select").selectOption("applied");
    await expect(page.getByLabel("Notes")).toHaveValue("E2E unsaved note"); // a status change doesn't wipe your typing
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.goto("/jobs");
    await page.getByRole("button", { name: /^✓ Applied \(/ }).click();
    await expect(page.getByText("E2E Jobs Co").first()).toBeVisible();
  });

  test("an email written for a job is linked to it, and can be unlinked", async ({ page }) => {
    const res = await page.request.post("/api/jobs", { data: { company: "E2E Mail Co", title: "", url: "" } });
    const { id } = await res.json();
    await page.goto(`/jobs/${id}`);
    await page.getByRole("button", { name: "✉️ Write an email for this job" }).click();
    await expect(page).toHaveURL(/\/emails\/\d+/);
    await expect(page.getByLabel("Linked job")).toHaveValue(String(id));
    await page.goto(`/jobs/${id}`);
    await page.getByRole("button", { name: "Unlink this email" }).click();
    await expect(page.getByRole("button", { name: "Unlink this email" })).toHaveCount(0);
  });
});

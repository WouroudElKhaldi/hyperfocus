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

test("Today: tasks for today (picked or due today), today's events, and a Study button (P3-22)", async ({ page }) => {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const stamp = Date.now();
  const due = await (await page.request.post("/api/tasks", { data: { title: `Due today ${stamp}`, dueDay: day } })).json();
  const ev = await (await page.request.post("/api/events", { data: { title: `Team meeting ${stamp}`, day, startTime: "23:30", endTime: "23:45", location: "Room 2" } })).json();
  try {
    await page.goto("/");
    await expect(page.getByText(`Due today ${stamp}`)).toBeVisible();
    const cal = page.getByRole("list", { name: "On your calendar today" });
    await expect(cal).toContainText(`Team meeting ${stamp}`);
    await expect(cal).toContainText("23:30–23:45");
    await expect(cal).toContainText("Room 2");
    await page.getByRole("link", { name: "📚 Study" }).click();
    await expect(page).toHaveURL(/\/study$/);
  } finally {
    await page.request.delete(`/api/events/${ev.id}`);
    await page.request.delete(`/api/tasks/${due.id}`);
  }
});

test("two more themes: all white and all black, from Settings; the top-bar switch flips between them (P3-26)", async ({ page }) => {
  await page.goto("/backup#look");
  const themes = page.getByRole("radiogroup", { name: "Theme" });
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  await themes.getByRole("radio", { name: "All black" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-look", "black");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(bg).toBe("rgb(0, 0, 0)");
  expect(await accent()).toBe("#f2f2f2");
  await page.getByRole("switch").first().click(); // the top bar: black → white
  await expect(page.locator("html")).toHaveAttribute("data-look", "white");
  await expect.poll(bg).toBe("rgb(255, 255, 255)");
  expect(await accent()).toBe("#111111");
  await page.reload(); // remembered
  await expect(page.locator("html")).toHaveAttribute("data-look", "white");
  await themes.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-look", /./);
  await themes.getByRole("radio", { name: "Automatic" }).click();
});

test("your menu: hide a page, make a group and move a page into it, then back to the standard menu (P3-27)", async ({ page }) => {
  await page.goto("/backup#look");
  const editor = page.getByRole("region", { name: "Your menu" });
  const sidebar = page.getByRole("navigation", { name: /main/i }).first();
  await expect(sidebar.getByRole("link", { name: "Books" })).toBeVisible();
  await editor.getByRole("button", { name: "Hide Books" }).click();
  await expect(sidebar.getByRole("link", { name: "Books" })).toHaveCount(0);
  await editor.getByLabel("New group").fill("Work");
  await editor.getByRole("button", { name: "Add group" }).click();
  await editor.getByLabel("Group for Email").selectOption({ label: "Work" });
  await expect(sidebar.getByRole("button", { name: /Work/ })).toBeVisible();
  await expect(editor.getByRole("list", { name: "Pages in Work" })).toContainText("Email");
  await page.reload(); // saved with the account
  await expect(sidebar.getByRole("link", { name: "Books" })).toHaveCount(0);
  await editor.getByRole("button", { name: "Back to the standard menu" }).click();
  await expect(sidebar.getByRole("link", { name: "Books" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /Work/ })).toHaveCount(0);
});

test("four languages: French, standard and Lebanese Arabic (right to left), back to English (P3-28)", async ({ page }) => {
  await page.goto("/backup#look");
  const sidebar = page.getByRole("navigation").first();
  await page.locator("#lang-settings").selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(sidebar.getByRole("link", { name: "Aujourd'hui" })).toBeVisible();
  await page.reload(); // remembered
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.locator("#lang-top").selectOption("ar-LB");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(sidebar.getByRole("link", { name: "دفتر الدرس" })).toBeVisible(); // Lebanese: "Study log"
  await page.locator("#lang-top").selectOption("ar");
  await expect(sidebar.getByRole("link", { name: "سجلّ الدراسة" })).toBeVisible(); // standard Arabic
  await page.locator("#lang-top").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(sidebar.getByRole("link", { name: "Study log" })).toBeVisible();
});

test("the Today page in French and Lebanese Arabic (P3-28: pages)", async ({ page }) => {
  await page.goto("/?lang=fr");
  await expect(page.getByRole("heading", { name: "Vide-tête" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Session de concentration" })).toBeVisible();
  await expect(page.getByRole("link", { name: "📚 Étudier" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dans 10 min" })).toBeVisible();
  await page.goto("/?lang=ar-LB");
  await expect(page.getByRole("heading", { name: "فضّي راسك" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "عالرزنامة اليوم" })).toBeVisible();
  await page.goto("/?lang=en");
  await expect(page.getByRole("heading", { name: "Brain dump" })).toBeVisible();
});

test("the Study page in French and Lebanese Arabic (P3-28: pages)", async ({ page }) => {
  await page.goto("/study?lang=fr");
  await expect(page.getByRole("heading", { name: "Journal d'étude", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ Lancer le chrono" })).toBeVisible();
  await page.goto("/study?lang=ar-LB");
  await expect(page.getByRole("heading", { name: "دفتر الدرس", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ شغّل العدّاد" })).toBeVisible();
  await page.goto("/study?lang=en");
});

test("LinkedIn posts in French and Lebanese Arabic (P3-28: pages)", async ({ page }) => {
  await page.goto("/posts?lang=fr");
  await expect(page.getByRole("heading", { name: "Posts LinkedIn", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Nouveau post" })).toBeVisible();
  await page.goto("/posts?lang=ar-LB");
  await expect(page.getByRole("heading", { name: "بوستات لينكدإن", level: 1 })).toBeVisible();
  await page.goto("/posts?lang=en");
});

test("Email in French and Lebanese Arabic (P3-28: pages)", async ({ page }) => {
  await page.goto("/emails?lang=fr");
  await expect(page.getByRole("heading", { name: "E-mail", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Nouvel e-mail" })).toBeVisible();
  await page.goto("/emails?lang=ar-LB");
  await expect(page.getByRole("heading", { name: "الإيميل", level: 1 })).toBeVisible();
  await page.goto("/emails?lang=en");
});

test("the Calendar in French and Lebanese Arabic (P3-28: pages)", async ({ page }) => {
  await page.goto("/calendar?lang=fr");
  await expect(page.getByRole("button", { name: "Aujourd'hui" }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Semaine" })).toBeVisible();
  await expect(page.getByText("lun.").first()).toBeVisible(); // weekday names in French
  await page.goto("/calendar?lang=ar-LB");
  await expect(page.getByRole("tab", { name: "جمعة" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "جايي" })).toBeVisible(); // "Coming up"
  // dates with Western digits (1, 2, 3), as in Lebanon: never Arabic-Indic ones (٠-٩)
  const main = await page.locator("main").innerText();
  expect(main).toMatch(/20\d\d/);
  expect(main).not.toMatch(/[٠-٩]/);
  await page.goto("/calendar?lang=en");
});

test("the Pet page in French and Lebanese Arabic, with its clothes and voice (P3-28: pages)", async ({ page }) => {
  if (!(await (await page.request.get("/api/pet")).json()).pet)
    await page.request.post("/api/pet", { data: { name: "Pixel", species: "cat", gender: "neutral", color: "#9b7bff", traits: [] } });
  await page.goto("/pet?lang=fr");
  await expect(page.getByRole("heading", { name: "Croissance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Garde-robe/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Tête" })).toBeVisible();
  await expect(page.getByText("Bonnet douillet")).toBeVisible(); // a name from the server, shown in French
  await page.goto("/pet?lang=ar-LB");
  await expect(page.getByRole("heading", { name: /^الخزانة/ })).toBeVisible();
  await expect(page.getByText("طاقية صوف")).toBeVisible();
  await page.goto("/pet?lang=en");
  await expect(page.getByRole("heading", { name: "Growth" })).toBeVisible();
});

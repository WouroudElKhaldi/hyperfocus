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

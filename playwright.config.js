import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests (P0-03). They run the real website against the safe test API, never your real data.
// Locally they use your installed Chrome; CI installs Playwright's own Chromium (`npx playwright install chromium`).
const API_PORT = 4310;
const WEB_PORT = 5310;
const browser = process.env.CI ? {} : { channel: "chrome" };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // one shared database
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/results",
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...browser } },
    { name: "phone", use: { ...devices["Pixel 7"], ...browser }, grep: /@phone/ },
  ],
  webServer: [
    {
      command: "node e2e/start-api.mjs",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "pnpm --filter ./apps/web dev",
      url: `http://localhost:${WEB_PORT}`,
      env: { WEB_PORT: String(WEB_PORT), API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});

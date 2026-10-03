import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests (P0-03). They run the real website against the safe test API, never your real data.
// Locally they use your installed Chrome; CI installs Playwright's own Chromium (`npx playwright install chromium`).
const API_PORT = 4310;
const WEB_PORT = 5310;
// the cloud-mode stack (P5-04): its own API and a second preview of the same build
const CLOUD_API_PORT = 4312;
const CLOUD_WEB_PORT = 5312;
const browser = process.env.CI ? {} : { channel: "chrome" };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // one shared database
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/results",
  snapshotPathTemplate: "e2e/__screenshots__/{arg}{ext}",
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...browser }, grepInvert: /@visual|@cloud/ },
    // accounts in cloud mode (P5-04): sign up, in, out, reset, against the cloud-mode stack
    { name: "cloud", use: { ...devices["Desktop Chrome"], ...browser, baseURL: `http://localhost:${CLOUD_WEB_PORT}` }, grep: /@cloud/ },
    { name: "phone", use: { ...devices["Pixel 7"], ...browser }, grep: /@phone/ },
    // only with `pnpm test:visual` (see e2e/visual.spec.js): needs a fresh database, so it never runs after the other tests
    { name: "visual", use: { ...devices["Desktop Chrome"], ...browser }, grep: /@visual/ },
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
      // a build of the site, not the dev server: what ships is what gets tested, and nothing compiles while the tests
      // run (the dev server's native compilers crashed it at random on Windows, 0xC0000409)
      // (builds once, then serves the build twice: the local-mode site here, the cloud-mode one on CLOUD_WEB_PORT)
      command: "node e2e/start-web.mjs",
      url: `http://localhost:${WEB_PORT}`,
      env: { WEB_PORT: String(WEB_PORT), API_PORT: String(API_PORT), CLOUD_WEB_PORT: String(CLOUD_WEB_PORT), CLOUD_API_PORT: String(CLOUD_API_PORT) },
      reuseExistingServer: false,
      timeout: 180000,
    },
    {
      command: "node e2e/start-api.mjs",
      url: `http://127.0.0.1:${CLOUD_API_PORT}/api/health`,
      env: { E2E_API_PORT: String(CLOUD_API_PORT), E2E_CLOUD: "1", E2E_PUBLIC_URL: `http://localhost:${CLOUD_WEB_PORT}` },
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      // the cloud-mode site is started by start-web.mjs above; this only waits for it
      command: "node -e \"setInterval(() => {}, 1 << 30)\"",
      url: `http://localhost:${CLOUD_WEB_PORT}`,
      reuseExistingServer: true, // (it is already up, started by start-web.mjs)
      timeout: 180000,
    },
  ],
});

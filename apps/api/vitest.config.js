import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    globalSetup: ["test/support/global-setup.js"],
    // every test file talks to the same running API and database, so they run one after another
    fileParallelism: false,
    testTimeout: 20000,
    // the unit tests import API modules, which check the settings on import (src/config.ts). These make that check pass
    // without a .env file (as in CI). The test API itself gets its own settings from test/support/stack.js.
    // RADAR_FETCH_OFF: no test, and no API a test starts, ever fetches from the real job sites (P6: it once did, 697
    // real postings in a test database, because four tests start their own API)
    env: { DATABASE_URL: "postgresql://unit-tests-never-open-this@127.0.0.1:1/never", NOTIFY_DRY_RUN: "1", RADAR_FETCH_OFF: "1" },
    hookTimeout: 60000,
  },
});

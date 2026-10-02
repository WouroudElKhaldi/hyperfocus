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
    env: { DATABASE_URL: "file:./unit-tests-never-open-this.db", NOTIFY_DRY_RUN: "1" },
    hookTimeout: 60000,
  },
});

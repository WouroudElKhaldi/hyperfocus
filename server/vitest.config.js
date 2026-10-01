import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    globalSetup: ["test/support/global-setup.js"],
    // every test file talks to the same running API and database, so they run one after another
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});

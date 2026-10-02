import { startTestStack } from "./stack.js";

// Vitest global setup: one safe API for all contract tests (see stack.js).
export default async function setup({ provide }) {
  const stack = await startTestStack();
  provide("apiUrl", stack.apiUrl);
  provide("aiUrl", stack.aiUrl);
  provide("n8nUrl", stack.n8nUrl);
  provide("tmpDir", stack.tmpDir);
  provide("databaseUrl", stack.databaseUrl);
  return stack.stop;
}

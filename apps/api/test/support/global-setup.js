import { startTestStack } from "./stack.js";
import { seedTaxonomy } from "./taxonomy-fixture.js";

// Vitest global setup: one safe API for all contract tests (see stack.js), with the small sample taxonomy imported
// (Software Developers, Python, Computer Science, Beirut…) so Job Radar tests have real lists to work with.
export default async function setup({ provide }) {
  const stack = await startTestStack();
  await seedTaxonomy(stack.databaseUrl);
  provide("apiUrl", stack.apiUrl);
  provide("aiUrl", stack.aiUrl);
  provide("n8nUrl", stack.n8nUrl);
  provide("tmpDir", stack.tmpDir);
  provide("databaseUrl", stack.databaseUrl);
  return stack.stop;
}

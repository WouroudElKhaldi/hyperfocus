import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { TYPES_FILE, apiTypes } from "../../scripts/api-types.mjs";

// P3-03: the website's API types (apps/web/src/api/schema.d.ts) are generated from this API's OpenAPI document. If a route
// or schema changes without regenerating them, the website could compile against an API that no longer exists.
describe("the website's API types", () => {
  it("are up to date with the API (if not, run `pnpm api:types`)", async () => {
    const committed = fs.readFileSync(TYPES_FILE, "utf8").replace(/\r\n/g, "\n");
    expect(committed === (await apiTypes()), "apps/web/src/api/schema.d.ts is out of date: run `pnpm api:types`").toBe(true);
  }, 30000);
});

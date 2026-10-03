import { createHmac } from "node:crypto";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { signIngest } from "../../src/modules/radar/ingest-routes.ts";

// P6-16: the optional n8n workflows are well-formed: valid JSON, connections to real nodes, code that parses, the
// signature built the way the ingest endpoint checks it.

const load = (name) => JSON.parse(fs.readFileSync(new URL(`../../../../integrations/n8n/${name}`, import.meta.url), "utf8"));
const flows = { ingest: load("job-radar-ingest.workflow.json"), error: load("job-radar-error.workflow.json") };

describe("n8n workflows", () => {
  for (const [name, flow] of Object.entries(flows)) {
    it(`${name}: every connection points at a real node, ids and names are unique, code parses`, () => {
      const names = flow.nodes.map((n) => n.name);
      expect(new Set(names).size).toBe(names.length);
      expect(new Set(flow.nodes.map((n) => n.id)).size).toBe(names.length);
      for (const [from, out] of Object.entries(flow.connections)) {
        expect(names).toContain(from);
        for (const branch of out.main) for (const to of branch) expect(names).toContain(to.node);
      }
      for (const n of flow.nodes) {
        expect(n.type).toMatch(/^n8n-nodes-base\./);
        if (n.parameters.jsCode) expect(() => new Function("$", "$json", "$execution", "$itemIndex", n.parameters.jsCode)).not.toThrow();
      }
    });
  }

  it("the batch it makes is signed the way the ingest endpoint checks it", () => {
    const code = flows.ingest.nodes.find((n) => n.name === "Make batch").parameters.jsCode;
    const run = new Function("$", "$json", "$execution", "$itemIndex", code);
    const out = run(() => ({ item: { json: { source: "arbeitnow", itemsAt: "data" } } }), { data: [{ slug: "a" }, { slug: "b" }] }, { id: "42" }, 0).json;
    expect(JSON.parse(out.body)).toEqual({ source: "arbeitnow", items: [{ slug: "a" }, { slug: "b" }] });
    expect(out.key).toBe("arbeitnow:42:0");
    const sign = flows.ingest.nodes.find((n) => n.name === "Sign").parameters;
    expect(sign).toMatchObject({ action: "hmac", type: "SHA256", encoding: "hex" });
    // what n8n's Crypto node gives, with the "sha256=" the Send node puts in front
    const hex = createHmac("sha256", "s".repeat(32)).update(out.toSign).digest("hex");
    expect(`sha256=${hex}`).toBe(signIngest("s".repeat(32), out.timestamp, out.body));
  });
});

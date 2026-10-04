import { describe, expect, it } from "vitest";
import { type AiMessage, type AiProvider, createAiGateway, describePerson, prompts } from "../src/index.ts";
import fs from "node:fs";

// The prompts describe whoever is asking, from their own profile, never a fixed person.

const seen: AiMessage[][] = [];
const provider: AiProvider = { name: "fake", unavailable: () => null, complete: async ({ messages }) => (seen.push(messages), JSON.stringify({ steps: ["a"] })) };

describe("who the AI is helping", () => {
  it("is described from their profile: name, title, place, their own words", () => {
    const d = describePerson({ name: "Rana", role: "Nursing student", location: "Tripoli", about: "Night shifts at a clinic", helps: "Short answers" });
    expect(d).toContain("named Rana");
    expect(d).toContain('"Nursing student"');
    expect(d).toContain("based in Tripoli");
    expect(d).toContain("Night shifts at a clinic");
    expect(d).toContain("Short answers");
    expect(describePerson(null)).toMatch(/never assume/);
  });

  it("the gateway puts the asking person into the prompt", async () => {
    const gw = createAiGateway({ provider, person: async () => ({ name: "Omar", role: "Accountant" }) });
    await gw.run(prompts.taskSteps, { task: "File the taxes" });
    expect(seen.at(-1)?.[0]?.content).toContain('"Accountant"');
    expect(seen.at(-1)?.[0]?.content).not.toContain("{{PERSON}}");
  });

  it("no prompt describes a fixed person any more", () => {
    const dir = new URL("../src/prompts/", import.meta.url);
    const text = fs.readdirSync(dir).map((f) => fs.readFileSync(new URL(f, dir), "utf8")).join(" ");
    for (const fixed of ["software engineer", "SE Square", "21-year-old", "woman", "mid to senior", "3 years of experience", " she ", " her "]) expect(text.toLowerCase()).not.toContain(fixed.toLowerCase());
  });
});

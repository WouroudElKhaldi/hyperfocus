import { describe, expect, it } from "vitest";
import { Automaton, makeExtractor, patternsFor } from "../../src/radar/skills.ts";

// P6-14: the skill extractor. Precision over recall: whole words only; everyday words and short names only when written
// as names; the names people really write for tools. (Measured on the 12 recorded postings: TASKS.md.)

const S = (id, name, type = "tool", altLabels = []) => ({ id, name, type, altLabels });
const skills = [
  S(1, "Python"), S(2, "Java"), S(3, "JavaScript"), S(4, "Microsoft Excel"), S(5, "Structured query language SQL"),
  S(6, "Deacom ERP"), S(7, "Enterprise resource planning ERP software"), S(8, "C++"), S(9, "Swift"), S(10, "Go"),
  S(11, "Microsoft Teams"), S(12, "Critical Thinking", "skill"), S(13, "Writing", "skill"), S(14, "Education and Training", "knowledge"),
  S(15, "use version control", "skill", ["git", "svn"]), S(16, "GitLab"), S(17, "Sales software"), S(18, "Route"),
  S(19, "National Instruments NI Vision Builder for Automated Inspection AI"), S(20, "Statistical energy analysis SEA software"),
  S(21, "Google Android"), S(22, "PostgreSQL"),
];
const ex = makeExtractor(skills);
const found = (text, company) => ex.find(text, company).sort((a, b) => a - b);

describe("the skill extractor", () => {
  it("finds tools by the names people write, as whole words", () => {
    expect(found("We use Python and Java daily; Excel and SQL are a plus. Android experience.")).toEqual([1, 2, 4, 5, 21]);
    expect(found("Strong JavaScript skills")).toEqual([3]); // not Java
    expect(found("Modern C++ and PostgreSQL, also postgresql")).toEqual([8, 22]);
    expect(found("pythonic code")).toEqual([]); // not a whole word
  });

  it("everyday words and one-word product names only when written as the name", () => {
    expect(found("You will swift-ly route requests and go home; teams of four")).toEqual([]);
    expect(found("Build iOS apps in Swift. Our Route integration.")).toEqual([9, 18]);
    expect(found("Go is our backend language")).toEqual([]); // 2 letters: too ambiguous even with a capital
  });

  it("an acronym only for the product its own words spell; common business codes never", () => {
    expect(found("Experience with ERP systems")).toEqual([7]); // not Deacom ERP
    expect(found("We use AI across the board. Markets: SEA and EMEA.")).toEqual([]);
  });

  it("broad abilities only as phrases; knowledge areas and one-word categories not at all", () => {
    expect(found("Critical thinking and writing; education and training budget; sales software")).toEqual([12, 17]);
    expect(found("Sales experience required")).toEqual([]);
  });

  it("alternative labels count; a skill named like the employer doesn't", () => {
    expect(found("Comfortable with git and code review")).toEqual([15]);
    expect(found("Join GitLab to build GitLab", "GitLab")).toEqual([]);
    expect(found("We host on GitLab", "Acme")).toEqual([16]);
  });

  it("the patterns: exact-case ones are marked, and the automaton finds overlapping keys", () => {
    const p = patternsFor(skills);
    expect(p.get("excel")).toEqual([{ skillId: 4, exact: "Excel" }]);
    expect(p.get("python")).toEqual([{ skillId: 1, exact: "Python" }]);
    expect(p.has("writing")).toBe(false);
    expect([...new Automaton(["he", "she", "hers"]).search("ushers")].map((m) => m.key)).toEqual(["she", "he", "hers"]);
  });

  it("reads a long posting fast", () => {
    const big = makeExtractor(Array.from({ length: 10000 }, (_, i) => S(i + 100, `Tool Number ${i}`)));
    const text = "Tool Number 42 and Tool Number 9999. ".repeat(500);
    const t = performance.now();
    expect(big.find(text).sort((a, b) => a - b)).toEqual([142, 10099]);
    expect(performance.now() - t).toBeLessThan(200);
  });
});

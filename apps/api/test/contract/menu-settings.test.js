import { describe, expect, it } from "vitest";
import { get, ok, patch } from "../support/api.js";

// P3-27: your menu is saved with your settings; a layout that breaks the rules is ignored; null is the standard menu.

describe("your menu", () => {
  it("saves a layout, ignores a broken one, and goes back to the standard menu", async () => {
    const menu = { groups: [{ id: "Plan", name: "", items: ["/", "/tasks"] }, { id: "g1", name: "Work", items: ["/emails", "/calendar"] }], hidden: ["/books"] };
    expect((await ok(patch("/api/settings", { menu }))).menu).toEqual(menu);
    expect((await ok(get("/api/settings"))).menu).toEqual(menu);
    // not a page address, too many groups: ignored (the saved one stays)
    expect((await ok(patch("/api/settings", { menu: { groups: [{ id: "x", name: "", items: ["javascript:alert(1)"] }], hidden: [] } }))).menu).toEqual(menu);
    expect((await ok(patch("/api/settings", { menu: { groups: Array.from({ length: 11 }, (_, i) => ({ id: `g${i}`, name: "", items: [] })), hidden: [] } }))).menu).toEqual(menu);
    expect((await ok(patch("/api/settings", { menu: null }))).menu).toBeNull();
  });
});

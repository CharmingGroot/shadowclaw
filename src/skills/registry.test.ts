import { describe, it, expect } from "vitest";
import * as registry from "./registry.js";

describe("SkillRegistry", () => {
  it("register and run", async () => {
    registry.register("_test_add", "Add two numbers", { a: "number", b: "number" }, (args) => {
      return (args.a as number) + (args.b as number);
    });
    const result = await registry.run("_test_add", { a: 1, b: 2 });
    expect(result).toBe(3);
  });

  it("listSkills includes registered skill", () => {
    registry.register("_test_list", "Desc", {}, () => null);
    const list = registry.listSkills();
    expect(list.some((s) => s.name === "_test_list")).toBe(true);
  });

  it("run unknown skill throws", async () => {
    await expect(registry.run("_nonexistent_skill_xyz", {})).rejects.toThrow("Unknown skill");
  });
});

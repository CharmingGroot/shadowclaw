import { describe, it, expect } from "vitest";
import * as mcpStore from "./mcpStore.js";

describe("mcpStore", () => {
  it("addServer and listServers", () => {
    const id = mcpStore.addServer({ name: "test", url: "http://localhost:9999" });
    expect(id).toBeDefined();
    const list = mcpStore.listServers();
    expect(list.some((s) => s.id === id)).toBe(true);
    expect(list.find((s) => s.id === id)?.name).toBe("test");
  });

  it("getServerTools", () => {
    const id = mcpStore.addServer({ tools: [{ name: "tool1", description: "d1" }] });
    const tools = mcpStore.getServerTools(id);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("tool1");
  });

  it("deleteServer", () => {
    const id = mcpStore.addServer({});
    expect(mcpStore.deleteServer(id)).toBe(true);
    expect(mcpStore.getServer(id)).toBeUndefined();
  });
});

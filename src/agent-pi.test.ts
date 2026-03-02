import { describe, it, expect, vi, beforeEach } from "vitest";
import { runPiStyle } from "./agent-pi.js";
import * as llm from "./llm/index.js";

describe("runPiStyle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns final content and messages when LLM returns no tool_calls", async () => {
    vi.spyOn(llm, "completeWithTools").mockResolvedValue({
      content: "Hello, this is the reply.",
      tool_calls: undefined,
    });
    const result = await runPiStyle("Hi", [], { model: "claude" });
    expect(result.content).toBe("Hello, this is the reply.");
    expect(result.tool_calls).toEqual([]);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("assistant");
    expect(result.messages[0].content).toBe("Hello, this is the reply.");
  });

  it("includes history in messages sent to LLM", async () => {
    const callArgs: unknown[] = [];
    vi.spyOn(llm, "completeWithTools").mockImplementation(async (params) => {
      callArgs.push(params);
      return { content: "Done.", tool_calls: undefined };
    });
    await runPiStyle("Second message", [{ role: "user", content: "First" }], { model: "claude" });
    expect(callArgs.length).toBeGreaterThanOrEqual(1);
    const firstCall = callArgs[0] as { messages: { role: string; content: string }[] };
    expect(firstCall.messages.some((m) => m.role === "user" && m.content === "First")).toBe(true);
    expect(firstCall.messages.some((m) => m.role === "user" && m.content === "Second message")).toBe(true);
  });
});

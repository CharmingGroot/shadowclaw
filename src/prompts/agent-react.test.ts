import { describe, it, expect } from "vitest";
import {
  buildAgentReactPrompt,
  buildSystemPrompt,
  buildCurrentTurnContent,
  turnsToMessages,
} from "./agent-react.js";

describe("buildSystemPrompt", () => {
  it("includes Identity, Format, Tooling, Observation rule", () => {
    const s = buildSystemPrompt({ skillsDesc: "- echo: echoes" });
    expect(s).toContain("## Identity");
    expect(s).toContain("## Output format");
    expect(s).toContain("## Tooling");
    expect(s).toContain("## Observation rule");
    expect(s).toContain("MUST apply any instructions from Observations");
    expect(s).toContain("- echo: echoes");
  });

  it("includes forceSkill when provided", () => {
    const s = buildSystemPrompt({ skillsDesc: "", forceSkill: "read_file" });
    expect(s).toContain('User requested to use skill "read_file"');
  });
});

describe("buildCurrentTurnContent", () => {
  it("includes user message and respond instruction", () => {
    const c = buildCurrentTurnContent({ userMessage: "hello", observations: [] });
    expect(c).toContain("User message:");
    expect(c).toContain("hello");
    expect(c).toContain("Respond with exactly one JSON object");
  });

  it("includes Observations when present", () => {
    const c = buildCurrentTurnContent({
      userMessage: "hi",
      observations: ["앞으로 어투는 --했습니다용~!"],
    });
    expect(c).toContain("Observations");
    expect(c).toContain("앞으로 어투는");
  });
});

describe("turnsToMessages", () => {
  it("returns role and content for each turn", () => {
    const msgs = turnsToMessages([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: "user", content: "a" });
    expect(msgs[1]).toEqual({ role: "assistant", content: "b" });
  });

  it("limits to last 12 turns and 2000 chars per content", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: "x".repeat(3000),
    }));
    const msgs = turnsToMessages(many);
    expect(msgs).toHaveLength(12);
    expect(msgs[0].content).toHaveLength(2000);
  });
});

describe("buildAgentReactPrompt", () => {
  it("includes instruction to apply Observations (tone/style) to final answer in system lines", () => {
    const prompt = buildAgentReactPrompt({
      userMessage: "hello",
      history: [],
      skillsDesc: "- echo: echoes",
      observations: [],
    });
    expect(prompt).toContain("MUST apply any instructions from Observations");
    expect(prompt).toContain("tone, style, or manner");
  });

  it("when observations exist, labels them as to be applied to final answer", () => {
    const prompt = buildAgentReactPrompt({
      userMessage: "who are you?",
      history: [],
      skillsDesc: "- 어두: set tone",
      observations: ["앞으로 모든 답변의 어투는 --했습니다용~! 로 한다."],
    });
    expect(prompt).toContain("Apply any tone/style/behavior instructions here to your final answer");
    expect(prompt).toContain("앞으로 모든 답변의 어투는");
  });
});

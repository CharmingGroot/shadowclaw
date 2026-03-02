import { describe, it, expect } from "vitest";
import {
  buildAgentReactPrompt,
  buildSystemPrompt,
  buildCurrentTurnContent,
  buildUserMessageContent,
  turnsToMessages,
  messagesToApiFormat,
} from "./agent-react.js";

describe("buildSystemPrompt", () => {
  it("includes Identity, Format, Tooling, Safety, Skills (read_file rule), Silent, Heartbeat, Runtime (OpenClaw-style sections)", () => {
    const s = buildSystemPrompt({ toolSummaries: { echo: "echoes input", read_file: "Read file contents" } });
    expect(s).toContain("ShadowClaw");
    expect(s).toContain("## Identity");
    expect(s).toContain("## Output format");
    expect(s).toContain("## Tooling");
    expect(s).toContain("## Tool Call Style");
    expect(s).toContain("## Safety");
    expect(s).toContain("## Skills (Mandatory)");
    expect(s).toContain("read_file");
    expect(s).toContain("SKILL.md");
    expect(s).toContain("## Silent Replies");
    expect(s).toContain("NO_REPLY");
    expect(s).toContain("## Heartbeats");
    expect(s).toContain("HEARTBEAT_OK");
    expect(s).toContain("## Runtime");
    expect(s).toContain("- echo: echoes input");
    expect(s).toContain("- read_file: Read file contents");
  });

  it("includes skill entries with path when skillEntries provided (OpenClaw-style)", () => {
    const s = buildSystemPrompt({
      toolSummaries: { read_file: "Read file" },
      skillEntries: [
        { name: "echo", description: "Echoes input", path: "skills/echo.md" },
        { name: "read_file", description: "Read file contents", path: "skills/read_file.md" },
      ],
    });
    expect(s).toContain("use read_file with the skill path");
    expect(s).toContain("path: skills/echo.md");
    expect(s).toContain("path: skills/read_file.md");
    expect(s).toContain("Echoes input");
  });

  it("promptMode none returns single identity line", () => {
    const s = buildSystemPrompt({ toolSummaries: { x: "y" }, promptMode: "none" });
    expect(s).toBe("You are a helpful assistant running inside ShadowClaw.");
  });

  it("promptMode minimal omits Silent Replies and Heartbeats", () => {
    const s = buildSystemPrompt({ toolSummaries: {}, promptMode: "minimal" });
    expect(s).toContain("## Safety");
    expect(s).not.toContain("## Silent Replies");
    expect(s).not.toContain("## Heartbeats");
  });

  it("includes Workspace when workspaceDir provided", () => {
    const s = buildSystemPrompt({ toolSummaries: {}, workspaceDir: "/home/user/proj" });
    expect(s).toContain("## Workspace");
    expect(s).toContain("/home/user/proj");
  });

  it("includes Memory when hasMemoryTools true", () => {
    const s = buildSystemPrompt({ toolSummaries: {}, hasMemoryTools: true });
    expect(s).toContain("## Memory");
    expect(s).toContain("memory tools");
  });

  it("omits ReAct JSON format when useNativeTools true (Pi/native tool calling)", () => {
    const s = buildSystemPrompt({ toolSummaries: { x: "y" }, useNativeTools: true });
    expect(s).not.toContain("Respond ONLY with a single JSON object");
    expect(s).not.toContain("## Output format");
    expect(s).not.toContain('"action":');
    expect(s).toContain("## Tooling");
    expect(s).toContain("- x: y");
  });

  it("includes Project Context and SOUL embody when contextFiles with SOUL.md provided", () => {
    const s = buildSystemPrompt({
      toolSummaries: {},
      contextFiles: [
        { path: "/w/SOUL.md", content: "앞으로 모든 답변의 어투는 --했습니다용~! 로 한다." },
      ],
    });
    expect(s).toContain("# Project Context");
    expect(s).toContain("embody its persona and tone");
    expect(s).toContain("했습니다용");
    expect(s).toContain("## /w/SOUL.md");
  });

  it("includes Project Context without SOUL embody when no SOUL.md in contextFiles", () => {
    const s = buildSystemPrompt({
      toolSummaries: {},
      contextFiles: [{ path: "/w/USER.md", content: "User preferences here." }],
    });
    expect(s).toContain("# Project Context");
    expect(s).not.toContain("embody its persona and tone");
    expect(s).toContain("User preferences here.");
  });

  it("includes forceSkill when provided", () => {
    const s = buildSystemPrompt({ toolSummaries: {}, forceSkill: "read_file" });
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

  it("includes Observations as neutral label (tool results only)", () => {
    const c = buildCurrentTurnContent({
      userMessage: "hi",
      observations: ["file content here"],
    });
    expect(c).toContain("Observations (last tool results):");
    expect(c).toContain("file content here");
    expect(c).not.toContain("Apply any tone");
  });

  it("includes skillParamsBlock when provided (ReAct args reference)", () => {
    const c = buildCurrentTurnContent({
      userMessage: "hi",
      observations: [],
      skillParamsBlock: "read_file: {\"path\":\"string\"}",
    });
    expect(c).toContain("Skill parameters (for call action");
    expect(c).toContain("read_file: {\"path\":\"string\"}");
  });
});

describe("buildUserMessageContent", () => {
  it("includes user message and skillParamsBlock only (no observations)", () => {
    const c = buildUserMessageContent({ userMessage: "hello", skillParamsBlock: "read_file: {}" });
    expect(c).toContain("User message:");
    expect(c).toContain("hello");
    expect(c).toContain("Skill parameters");
    expect(c).toContain("Respond with exactly one JSON object");
    expect(c).not.toContain("Observations");
  });
});

describe("messagesToApiFormat", () => {
  it("converts tool role to user message with Observation prefix", () => {
    const out = messagesToApiFormat([
      { role: "user", content: "hi" },
      { role: "assistant", content: "json" },
      { role: "tool", content: "result" },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ role: "user", content: "hi" });
    expect(out[1]).toEqual({ role: "assistant", content: "json" });
    expect(out[2]!.role).toBe("user");
    expect(out[2]!.content).toContain("Observation (tool result):");
    expect(out[2]!.content).toContain("result");
  });

  it("limits to maxMessages and maxContentChars", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 3 === 0 ? "user" : i % 3 === 1 ? "assistant" : "tool") as "user" | "assistant" | "tool",
      content: "x".repeat(3000),
    }));
    const msgs = messagesToApiFormat(many, { maxMessages: 10, maxContentChars: 100 });
    expect(msgs).toHaveLength(10);
    expect(msgs[0]!.content.length).toBeLessThanOrEqual(100);
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
  it("composes system (toolSummaries) and current turn with skillParamsBlock and observations", () => {
    const prompt = buildAgentReactPrompt({
      userMessage: "hello",
      history: [],
      toolSummaries: { echo: "echoes" },
      skillParamsBlock: "echo: {}",
      observations: ["result 1"],
    });
    expect(prompt).toContain("## Tooling");
    expect(prompt).toContain("- echo: echoes");
    expect(prompt).toContain("Skill parameters (for call action");
    expect(prompt).toContain("Observations (last tool results):");
    expect(prompt).toContain("result 1");
  });
});

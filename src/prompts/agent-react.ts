/**
 * ReAct 에이전트용 프롬프트 (OpenClaw 스타일: 시스템 vs 메시지 분리).
 * - 시스템: 역할·형식·스킬 요약. 톤/페르소나는 contextFiles(SOUL.md 등)로 Project Context에 주입.
 * - Observations: 도구 결과만 중립적으로 전달.
 */
import type { EmbeddedContextFile } from "../context-files.js";

export const ACTION_CALL = "call";
export const ACTION_ANSWER = "answer";

function formatCallExample(actionCall: string): string {
  return `{"thought": "reasoning", "action": "${actionCall}", "skill": "<name>", "args": {...}}`;
}

function formatAnswerExample(actionAnswer: string): string {
  return `{"thought": "reasoning", "action": "${actionAnswer}", "content": "<response in Korean or English>"}`;
}

/** 도구별 한 줄 요약 (OpenClaw 스타일). 시스템에는 이름+요약만, 상세 스키마는 현재 턴 또는 API로. */
export type ToolSummaries = Record<string, string>;

/** 시스템 프롬프트: 역할·형식·도구 요약. contextFiles 있으면 OpenClaw처럼 Project Context 섹션 추가. */
export function buildSystemPrompt(params: {
  toolSummaries: ToolSummaries;
  forceSkill?: string;
  /** 워크스페이스 bootstrap 파일들 (SOUL.md, USER.md 등). OpenClaw contextFiles 동일. */
  contextFiles?: EmbeddedContextFile[];
}): string {
  const { toolSummaries, forceSkill, contextFiles = [] } = params;
  const lines: string[] = [
    "## Identity",
    "You are a helpful assistant with access to skills (tools). Respond ONLY with a single JSON object.",
    "",
  ];

  const validContextFiles = contextFiles.filter(
    (f) => typeof f.path === "string" && f.path.trim().length > 0
  );
  if (validContextFiles.length > 0) {
    const hasSoulFile = validContextFiles.some((f) => {
      const base = f.path.trim().replace(/\\/g, "/").split("/").pop() ?? "";
      return base.toLowerCase() === "soul.md";
    });
    lines.push("# Project Context", "", "The following project context files have been loaded:");
    if (hasSoulFile) {
      lines.push(
        "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
        ""
      );
    }
    lines.push("");
    for (const file of validContextFiles) {
      lines.push(`## ${file.path}`, "", file.content, "");
    }
  }

  lines.push(
    "## Output format",
    "Format 1 - Call a skill (Thought → Action):",
    formatCallExample(ACTION_CALL),
    "Format 2 - Final answer (Thought → Answer):",
    formatAnswerExample(ACTION_ANSWER),
    "",
    "## Tooling",
    "Tool names are case-sensitive. Call tools exactly as listed:",
    ...Object.entries(toolSummaries).map(([name, summary]) => `- ${name}: ${summary}`),
    ""
  );
  if (forceSkill) {
    lines.push(`User requested to use skill "${forceSkill}". Prefer calling it with appropriate args.`, "");
  }
  return lines.join("\n");
}

/** 현재 턴의 user 메시지 내용만 (Observations 없음). 도구 결과는 messages[]에서 role "tool"로 전달. */
export function buildUserMessageContent(params: {
  userMessage: string;
  /** 스킬별 params_schema (ReAct용). */
  skillParamsBlock?: string;
}): string {
  const { userMessage, skillParamsBlock } = params;
  const lines: string[] = ["User message:", userMessage, ""];
  if (skillParamsBlock?.trim()) {
    lines.push("Skill parameters (for call action, use these args):", skillParamsBlock.trim(), "");
  }
  lines.push("Respond with exactly one JSON object:");
  return lines.join("\n");
}

/** 현재 턴용 user 메시지 내용. skillParamsBlock 있으면 ReAct에서 args 채울 때 참고 (레거시·단일 프롬프트용). */
export function buildCurrentTurnContent(params: {
  userMessage: string;
  observations: string[];
  skillParamsBlock?: string;
}): string {
  const { userMessage, observations, skillParamsBlock } = params;
  const lines: string[] = ["User message:", userMessage, ""];
  if (skillParamsBlock?.trim()) {
    lines.push("Skill parameters (for call action, use these args):", skillParamsBlock.trim(), "");
  }
  if (observations.length) {
    lines.push("Observations (last tool results):");
    observations.slice(-3).forEach((o, i) => {
      lines.push(`${i + 1}. ${String(o).slice(0, 1200)}`);
    });
    lines.push("");
  }
  lines.push("Respond with exactly one JSON object:");
  return lines.join("\n");
}

const OBSERVATION_PREFIX = "Observation (tool result):";

/** Message[] (user/assistant/tool) → API용 ContextMessage[]. role "tool"는 user 메시지로 변환 (ReAct는 텍스트만 사용). */
export function messagesToApiFormat(
  messages: { role: string; content: string }[],
  opts?: { maxMessages?: number; maxContentChars?: number }
): { role: "user" | "assistant"; content: string }[] {
  const maxMessages = opts?.maxMessages ?? 30;
  const maxContentChars = opts?.maxContentChars ?? 2000;
  const slice = messages.slice(-maxMessages);
  return slice.map((m) => {
    const content = (m.content || "").slice(0, maxContentChars);
    if (m.role === "tool") {
      return { role: "user" as const, content: `${OBSERVATION_PREFIX}\n${content}` };
    }
    return { role: m.role as "user" | "assistant", content };
  });
}

/** 히스토리 턴 배열 → API용 메시지 배열 (role + content). 레거시용. */
export function turnsToMessages(
  turns: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  return messagesToApiFormat(turns, { maxMessages: 12 });
}

// --- 레거시: 단일 프롬프트 (테스트·폴백용)

export interface BuildAgentReactPromptParams {
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  toolSummaries: ToolSummaries;
  skillParamsBlock?: string;
  observations: string[];
  forceSkill?: string;
}

export function buildAgentReactPrompt(params: BuildAgentReactPromptParams): string {
  const systemPrompt = buildSystemPrompt({
    toolSummaries: params.toolSummaries,
    forceSkill: params.forceSkill,
  });
  const currentContent = buildCurrentTurnContent({
    userMessage: params.userMessage,
    observations: params.observations,
    skillParamsBlock: params.skillParamsBlock,
  });
  const historyBlock =
    params.history.length > 0
      ? "Recent conversation:\n" +
        params.history
          .slice(-6)
          .map((t) => `- ${t.role}: ${(t.content || "").slice(0, 300)}`)
          .join("\n") +
        "\n\n"
      : "";
  return systemPrompt + "\n" + historyBlock + currentContent;
}

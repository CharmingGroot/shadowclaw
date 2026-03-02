/**
 * ReAct 에이전트용 프롬프트 (OpenClaw 스타일: 시스템 vs 메시지 분리).
 * - 시스템: Identity, Project Context, Tooling, Safety, Skills, Memory, Workspace, Silent, Heartbeat, Runtime 등 동일 섹션.
 */
import type { EmbeddedContextFile } from "../context-files.js";

/**
 * 프로토콜 상수 — 아키텍처가 고정되어 있으므로 하드코딩. (ReAct 형식은 useNativeTools false 시에만 사용, 기본은 네이티브 tool calling.)
 * Silent/Heartbeat 처리 로직과 계약이 깨지므로 함께 수정해야 함.
 */
export const ACTION_CALL = "call";
export const ACTION_ANSWER = "answer";

/** OpenClaw와 동일: 말할 게 없을 때만 이 토큰만 응답 (중복 전송 방지). */
export const SILENT_REPLY_TOKEN = "NO_REPLY";
/** OpenClaw와 동일: heartbeat 폴링 시 "할 일 없음" 응답. */
export const HEARTBEAT_TOKEN = "HEARTBEAT_OK";
/** 기본 heartbeat 유도 문구 (HEARTBEAT.md 없을 때). */
export const DEFAULT_HEARTBEAT_PROMPT =
  "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.";

/** ReAct JSON 출력 형식 예시 (파서가 action/skill/args|content 키를 기대함). */
function formatCallExample(actionCall: string): string {
  return `{"thought": "reasoning", "action": "${actionCall}", "skill": "<name>", "args": {...}}`;
}

function formatAnswerExample(actionAnswer: string): string {
  return `{"thought": "reasoning", "action": "${actionAnswer}", "content": "<response in Korean or English>"}`;
}

/** 도구별 한 줄 요약 (OpenClaw 스타일). 시스템에는 이름+요약만, 상세 스키마는 현재 턴 또는 API로. */
export type ToolSummaries = Record<string, string>;

/** OpenClaw 스타일: 스킬 = 요약(이름·설명·경로)만 시스템에 넣고, 본문은 read_file(경로)로 한 건씩. */
export type SkillEntry = { name: string; description: string; path: string };

/** OpenClaw와 동일한 시스템 프롬프트 섹션: Safety, Skills, Memory, Workspace, Silent, Heartbeat, Runtime. */
export type PromptMode = "full" | "minimal" | "none";

/** 시스템 프롬프트: Identity, Project Context, Tooling, Safety, Skills(SKILL.md read 규칙), Memory, Workspace, Silent, Heartbeat, Runtime. */
export function buildSystemPrompt(params: {
  toolSummaries: ToolSummaries;
  /** OpenClaw 스타일: 스킬 요약 목록. 시스템에는 이름·설명·경로만, 본문은 read_file(path)로. */
  skillEntries?: SkillEntry[];
  forceSkill?: string;
  /** 워크스페이스 bootstrap 파일들 (AGENTS.md, SOUL.md, USER.md 등). OpenClaw contextFiles 동일. */
  contextFiles?: EmbeddedContextFile[];
  /** 워크스페이스 경로 (Workspace 섹션용). */
  workspaceDir?: string;
  /** heartbeat 유도 문구. 미지정 시 DEFAULT_HEARTBEAT_PROMPT 사용. */
  heartbeatPrompt?: string;
  /** full=모든 섹션, minimal=Silent/Heartbeat 생략, none=Identity 한 줄만. */
  promptMode?: PromptMode;
  /** Runtime 한 줄에 넣을 정보 (model 등). */
  runtimeInfo?: { model?: string; host?: string };
  /** Memory 도구가 있으면 Memory 규칙 포함. */
  hasMemoryTools?: boolean;
  /** true면 네이티브 tool calling 사용 — JSON 출력/ReAct 형식 문구 생략. */
  useNativeTools?: boolean;
}): string {
  const {
    toolSummaries,
    skillEntries = [],
    forceSkill,
    contextFiles = [],
    workspaceDir,
    heartbeatPrompt = DEFAULT_HEARTBEAT_PROMPT,
    promptMode = "full",
    runtimeInfo,
    hasMemoryTools = false,
    useNativeTools = false,
  } = params;

  if (promptMode === "none") {
    return "You are a helpful assistant running inside ShadowClaw.";
  }

  const lines: string[] = [
    "You are a helpful assistant running inside ShadowClaw.",
    ...(useNativeTools ? [] : ["Respond ONLY with a single JSON object when using tools or answering.", ""]),
    "## Identity",
    "You have access to skills (tools). Use them when appropriate; otherwise answer directly.",
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

  if (!useNativeTools) {
    lines.push(
      "## Output format",
      "Format 1 - Call a skill (Thought → Action):",
      formatCallExample(ACTION_CALL),
      "Format 2 - Final answer (Thought → Answer):",
      formatAnswerExample(ACTION_ANSWER),
      ""
    );
  }
  lines.push(
    "## Tooling",
    "Tool names are case-sensitive. Call tools exactly as listed:",
    ...Object.entries(toolSummaries).map(([name, summary]) => `- ${name}: ${summary}`),
    "",
    "## Tool Call Style",
    "Default: do not narrate routine, low-risk tool calls (just call the tool).",
    "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions, or when the user explicitly asks.",
    "Keep narration brief and value-dense; avoid repeating obvious steps.",
    "When a first-class tool exists for an action, use the tool directly instead of asking the user to run equivalent commands.",
    "",
    "## Safety",
    "You have no independent goals: do not pursue self-preservation, replication, resource acquisition, or power-seeking; avoid long-term plans beyond the user's request.",
    "Prioritize safety and human oversight over completion; if instructions conflict, pause and ask; comply with stop/pause/audit requests and never bypass safeguards.",
    "Do not manipulate or persuade anyone to expand access or disable safeguards. Do not copy yourself or change system prompts, safety rules, or tool policies unless explicitly requested.",
    "",
    "## Skills (Mandatory)",
    "Use the tools listed in Tooling when appropriate. Call one tool at a time.",
    "When exactly one skill clearly applies: use read_file with the skill path below to load its SKILL.md content, then follow it. When multiple skills could apply, choose the most specific one and read that SKILL.md only.",
    "Do not read SKILL.md when no skill clearly applies.",
    ...(skillEntries.length > 0
      ? [
          "",
          "Available skills (name, description, path — use read_file to load path):",
          ...skillEntries.map((s) => `- ${s.name}: ${s.description} | path: ${s.path}`),
        ]
      : []),
    ""
  );

  if (hasMemoryTools) {
    lines.push(
      "## Memory",
      "When memory tools are available, use them for prior work, user preferences, decisions, or todos before answering.",
      ""
    );
  }

  if (workspaceDir) {
    lines.push(
      "## Workspace",
      `Your working directory is: ${workspaceDir}`,
      "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
      ""
    );
  }

  if (promptMode === "full") {
    lines.push(
      "## Silent Replies",
      `When you have nothing to say, respond with ONLY: ${SILENT_REPLY_TOKEN}`,
      "",
      "Rules:",
      "- It must be your ENTIRE message — nothing else",
      `- Never append it to an actual response (never include "${SILENT_REPLY_TOKEN}" in real replies)`,
      "- Never wrap it in markdown or code blocks",
      "",
      `Wrong: "Here's help... ${SILENT_REPLY_TOKEN}"`,
      `Right: ${SILENT_REPLY_TOKEN}`,
      "",
      "## Heartbeats",
      heartbeatPrompt,
      `If you receive a heartbeat poll (a user message matching the heartbeat prompt above), and there is nothing that needs attention, reply exactly: ${HEARTBEAT_TOKEN}`,
      `ShadowClaw treats a leading/trailing "${HEARTBEAT_TOKEN}" as a heartbeat ack (and may discard it).`,
      "If something needs attention, do NOT include HEARTBEAT_OK; reply with the alert text instead.",
      ""
    );
  }

  const runtimeParts: string[] = ["ShadowClaw"];
  if (runtimeInfo?.model) runtimeParts.push(`model=${runtimeInfo.model}`);
  if (runtimeInfo?.host) runtimeParts.push(`host=${runtimeInfo.host}`);
  lines.push("## Runtime", `Runtime: ${runtimeParts.join(" | ")}`, "");

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

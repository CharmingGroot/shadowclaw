/**
 * ReAct 에이전트용 프롬프트 (OpenClaw 스타일: 시스템 vs 메시지 분리).
 * - 시스템 프롬프트: 역할·형식·스킬 요약·관찰 적용 지시.
 * - 현재 턴: 스킬 목록·유저 메시지·Observations·응답 형식 지시.
 */

export const ACTION_CALL = "call";
export const ACTION_ANSWER = "answer";

function formatCallExample(actionCall: string): string {
  return `{"thought": "reasoning", "action": "${actionCall}", "skill": "<name>", "args": {...}}`;
}

function formatAnswerExample(actionAnswer: string): string {
  return `{"thought": "reasoning", "action": "${actionAnswer}", "content": "<response in Korean or English>"}`;
}

/** OpenClaw 스타일: 시스템 프롬프트만 구성 (역할·형식·스킬 한 줄 요약·관찰 적용). */
export function buildSystemPrompt(params: {
  skillsDesc: string;
  forceSkill?: string;
}): string {
  const { skillsDesc, forceSkill } = params;
  const lines: string[] = [
    "## Identity",
    "You are a helpful assistant with access to skills (tools). Respond ONLY with a single JSON object.",
    "",
    "## Output format",
    "Format 1 - Call a skill (Thought → Action):",
    formatCallExample(ACTION_CALL),
    "Format 2 - Final answer (Thought → Answer):",
    formatAnswerExample(ACTION_ANSWER),
    "",
    "## Tooling",
    "Available skills (name and one-line description). Tool names are case-sensitive. Call tools exactly as listed:",
    skillsDesc,
    "",
    "## Observation rule",
    "When you give a final answer (action: answer), you MUST apply any instructions from Observations to your reply: e.g. if a skill set a tone, style, or manner (어투), use that tone in your content.",
    "",
  ];
  if (forceSkill) {
    lines.push(`User requested to use skill "${forceSkill}". Prefer calling it with appropriate args.`, "");
  }
  return lines.join("\n");
}

/** 현재 턴용 user 메시지 내용 (유저 메시지 + Observations 블록 + 응답 지시). 히스토리는 messages[]로 별도 전달. */
export function buildCurrentTurnContent(params: {
  userMessage: string;
  observations: string[];
}): string {
  const { userMessage, observations } = params;
  const lines: string[] = ["User message:", userMessage, ""];
  if (observations.length) {
    lines.push(
      "Observations (last tool results). Apply any tone/style/behavior instructions here to your final answer:"
    );
    observations.slice(-3).forEach((o, i) => {
      lines.push(`${i + 1}. ${String(o).slice(0, 1200)}`);
    });
    lines.push("");
  }
  lines.push("Respond with exactly one JSON object:");
  return lines.join("\n");
}

/** 히스토리 턴 배열 → API용 메시지 배열 (role + content). */
export function turnsToMessages(
  turns: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  const maxTurns = 12;
  const slice = turns.slice(-maxTurns);
  return slice.map((t) => ({ role: t.role, content: (t.content || "").slice(0, 2000) }));
}

// --- 레거시: 단일 프롬프트 (테스트·폴백용)

export interface BuildAgentReactPromptParams {
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  skillsDesc: string;
  observations: string[];
  forceSkill?: string;
}

export function buildAgentReactPrompt(params: BuildAgentReactPromptParams): string {
  const systemPrompt = buildSystemPrompt({
    skillsDesc: params.skillsDesc,
    forceSkill: params.forceSkill,
  });
  const currentContent = buildCurrentTurnContent({
    userMessage: params.userMessage,
    observations: params.observations,
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

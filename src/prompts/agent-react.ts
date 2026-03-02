/**
 * ReAct 에이전트용 시스템/지시 프롬프트 (Thought → Action | Answer).
 * react.ts에서 context assembly 시 사용.
 */

export const ACTION_CALL = "call";
export const ACTION_ANSWER = "answer";

const SYSTEM_LINES = [
  "You are a helpful assistant with access to skills (tools). Respond ONLY with a single JSON object.",
  "",
];

function formatCallExample(actionCall: string): string {
  return `{"thought": "reasoning", "action": "${actionCall}", "skill": "<name>", "args": {...}}`;
}

function formatAnswerExample(actionAnswer: string): string {
  return `{"thought": "reasoning", "action": "${actionAnswer}", "content": "<response in Korean or English>"}`;
}

export interface BuildAgentReactPromptParams {
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  skillsDesc: string;
  observations: string[];
  forceSkill?: string;
}

export function buildAgentReactPrompt(params: BuildAgentReactPromptParams): string {
  const { userMessage, history, skillsDesc, observations, forceSkill } = params;
  const lines: string[] = [...SYSTEM_LINES];

  if (forceSkill) {
    lines.push(`User requested to use skill "${forceSkill}". Prefer calling it with appropriate args.`, "");
  }

  lines.push(
    "Format 1 - Call a skill (Thought → Action):",
    formatCallExample(ACTION_CALL),
    "Format 2 - Final answer (Thought → Answer):",
    formatAnswerExample(ACTION_ANSWER),
    "",
    "Available skills:",
    skillsDesc,
    "",
    "User message:",
    userMessage,
    ""
  );

  if (history.length) {
    lines.push("Recent conversation:");
    history.slice(-6).forEach((t) => {
      lines.push(`- ${t.role}: ${(t.content || "").slice(0, 300)}`);
    });
    lines.push("");
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

import { stubResponse, stubResponseWithContext, stubResponseWithTools } from "./stub.js";
import { callClaudeWithContext, callClaudeWithTools } from "./claude.js";
import { callOpenAIWithContext, callOpenAIWithTools } from "./openai.js";
import { skillsToOpenAITools, skillsToClaudeTools } from "./skill-to-tool-schema.js";
import type { SkillMeta } from "../types.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type ModelKind = "claude" | "gpt";

export type ContextMessage = { role: "user" | "assistant"; content: string };

/** 도구 호출 한 건 (네이티브 tool calling). */
export type ToolCallSpec = { id: string; name: string; arguments: string };

/** completeWithTools용 메시지: assistant는 tool_calls, tool은 tool_call_id. */
export type MessageWithTools =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCallSpec[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type CompleteWithToolsResult = { content?: string; tool_calls?: ToolCallSpec[] };

/** API Key는 환경변수(ANTHROPIC_API_KEY, OPENAI_API_KEY)에서만 읽음. 요청 바디로 받지 않음. */
export async function complete(prompt: string, model: ModelKind = "claude"): Promise<string> {
  const out = await completeWithTools(
    { systemPrompt: "", messages: [{ role: "user", content: prompt }], tools: [] },
    model
  );
  return out.content ?? "";
}

/** OpenClaw 스타일: 시스템 프롬프트 + 메시지 배열로 LLM 호출. */
export async function completeWithContext(
  params: { systemPrompt: string; messages: ContextMessage[] },
  model: ModelKind = "claude"
): Promise<string> {
  const out = await completeWithTools(
    { systemPrompt: params.systemPrompt, messages: params.messages, tools: [] },
    model
  );
  return out.content ?? "";
}

/** 네이티브 tool calling: tools 배열과 메시지(assistant tool_calls, tool 결과) 지원. */
export async function completeWithTools(
  params: { systemPrompt: string; messages: MessageWithTools[]; tools: SkillMeta[] },
  model: ModelKind = "claude"
): Promise<CompleteWithToolsResult> {
  const { systemPrompt, messages, tools } = params;
  const keyClaude = ANTHROPIC_API_KEY?.trim();
  const keyOpenAI = OPENAI_API_KEY?.trim();
  const claudeTools = skillsToClaudeTools(tools);
  const openaiTools = skillsToOpenAITools(tools);
  if (model === "claude" && keyClaude) return callClaudeWithTools({ systemPrompt, messages, tools: claudeTools }, keyClaude);
  if (model === "gpt" && keyOpenAI) return callOpenAIWithTools({ systemPrompt, messages, tools: openaiTools }, keyOpenAI);
  if (keyOpenAI) return callOpenAIWithTools({ systemPrompt, messages, tools: openaiTools }, keyOpenAI);
  if (keyClaude) return callClaudeWithTools({ systemPrompt, messages, tools: claudeTools }, keyClaude);
  return stubResponseWithTools(messages as { role: string; content: string }[]);
}

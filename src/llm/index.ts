import { stubResponse, stubResponseWithContext } from "./stub.js";
import { callClaude, callClaudeWithContext } from "./claude.js";
import { callOpenAI, callOpenAIWithContext } from "./openai.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type ModelKind = "claude" | "gpt";

export type ContextMessage = { role: "user" | "assistant"; content: string };

/** API Key는 환경변수(ANTHROPIC_API_KEY, OPENAI_API_KEY)에서만 읽음. 요청 바디로 받지 않음. */
export async function complete(prompt: string, model: ModelKind = "claude"): Promise<string> {
  const wantClaude = model === "claude";
  const keyClaude = ANTHROPIC_API_KEY?.trim();
  const keyOpenAI = OPENAI_API_KEY?.trim();
  if (wantClaude && keyClaude) return callClaude(prompt, keyClaude);
  if (!wantClaude && keyOpenAI) return callOpenAI(prompt, keyOpenAI);
  if (keyOpenAI) return callOpenAI(prompt, keyOpenAI);
  if (keyClaude) return callClaude(prompt, keyClaude);
  return stubResponse(prompt);
}

/** OpenClaw 스타일: 시스템 프롬프트 + 메시지 배열로 LLM 호출. */
export async function completeWithContext(
  params: { systemPrompt: string; messages: ContextMessage[] },
  model: ModelKind = "claude"
): Promise<string> {
  const { systemPrompt, messages } = params;
  const keyClaude = ANTHROPIC_API_KEY?.trim();
  const keyOpenAI = OPENAI_API_KEY?.trim();
  if (model === "claude" && keyClaude) return callClaudeWithContext({ systemPrompt, messages }, keyClaude);
  if (model === "gpt" && keyOpenAI) return callOpenAIWithContext({ systemPrompt, messages }, keyOpenAI);
  if (keyOpenAI) return callOpenAIWithContext({ systemPrompt, messages }, keyOpenAI);
  if (keyClaude) return callClaudeWithContext({ systemPrompt, messages }, keyClaude);
  return stubResponseWithContext(messages);
}

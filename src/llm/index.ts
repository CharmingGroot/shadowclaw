import { stubResponse } from "./stub.js";
import { callClaude } from "./claude.js";
import { callOpenAI } from "./openai.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type ModelKind = "claude" | "gpt";

/** API Key는 환경변수(ANTHROPIC_API_KEY, OPENAI_API_KEY)에서만 읽음. 요청 바디로 받지 않음. */
export async function complete(prompt: string, model: ModelKind = "claude"): Promise<string> {
  const wantClaude = model === "claude";
  const keyClaude = ANTHROPIC_API_KEY?.trim();
  const keyOpenAI = OPENAI_API_KEY?.trim();
  // 선택한 모델 키가 없으면 다른 프로바이더 키가 있으면 그걸 사용 (키 줬는데 안 쓰는 상황 방지)
  if (wantClaude && keyClaude) return callClaude(prompt, keyClaude);
  if (!wantClaude && keyOpenAI) return callOpenAI(prompt, keyOpenAI);
  if (keyOpenAI) return callOpenAI(prompt, keyOpenAI);
  if (keyClaude) return callClaude(prompt, keyClaude);
  return stubResponse(prompt);
}

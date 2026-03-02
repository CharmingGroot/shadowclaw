import { stubResponse } from "./stub.js";
import { callClaude } from "./claude.js";
import { callOpenAI } from "./openai.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type ModelKind = "claude" | "gpt";

/** API Key는 환경변수(ANTHROPIC_API_KEY, OPENAI_API_KEY)에서만 읽음. 요청 바디로 받지 않음. */
export async function complete(prompt: string, model: ModelKind = "claude"): Promise<string> {
  const key = model === "claude" ? ANTHROPIC_API_KEY : OPENAI_API_KEY;
  if (!key) {
    return stubResponse(prompt);
  }
  if (model === "claude") return callClaude(prompt, key);
  return callOpenAI(prompt, key);
}

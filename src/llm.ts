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

function stubResponse(prompt: string): string {
  const hasUserMessage = /User message:\s*\n?([\s\S]*?)(?=\n\n|$)/.exec(prompt);
  const userText = hasUserMessage ? hasUserMessage[1].trim().slice(0, 200) : "";
  return JSON.stringify({
    thought: "No API key set. Returning stub answer.",
    action: "answer",
    content: userText
      ? `(스텁) "${userText}" 에 대한 응답입니다. API Key를 설정하면 실제 LLM이 응답합니다.`
      : "API Key를 설정하면 ReAct·LLM이 동작합니다.",
  });
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude API error: ${res.status} ${t}`);
  }
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (j.content ?? [])
    .filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
  return text || "";
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${t}`);
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? "";
}

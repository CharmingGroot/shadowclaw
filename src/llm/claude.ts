export type ClaudeMessage = { role: "user" | "assistant"; content: string };

export async function callClaude(prompt: string, apiKey: string): Promise<string> {
  return callClaudeWithContext({ systemPrompt: "", messages: [{ role: "user", content: prompt }] }, apiKey);
}

export async function callClaudeWithContext(
  params: { systemPrompt: string; messages: ClaudeMessage[] },
  apiKey: string
): Promise<string> {
  const { systemPrompt, messages } = params;
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemPrompt.trim()) body.system = systemPrompt;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
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

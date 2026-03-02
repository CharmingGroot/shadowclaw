export type OpenAIMessage = { role: "user" | "assistant" | "system"; content: string };

export async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  return callOpenAIWithContext({ systemPrompt: "", messages: [{ role: "user", content: prompt }] }, apiKey);
}

export async function callOpenAIWithContext(
  params: { systemPrompt: string; messages: { role: "user" | "assistant"; content: string }[] },
  apiKey: string
): Promise<string> {
  const { systemPrompt, messages } = params;
  const apiMessages: OpenAIMessage[] =
    systemPrompt.trim() ? [{ role: "system", content: systemPrompt }, ...messages] : [...messages];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: apiMessages,
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

import type { OpenAITool } from "./skill-to-tool-schema.js";

export type OpenAIMessage = { role: "user" | "assistant" | "system"; content: string };

export type OpenAIToolCall = { id: string; name: string; arguments: string };

/** API에 보낼 메시지: assistant는 tool_calls, tool은 tool_call_id 포함 */
export type OpenAIMessageWithTools =
  | { role: "user" | "system"; content: string }
  | { role: "assistant"; content: string; tool_calls?: OpenAIToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  return callOpenAIWithContext({ systemPrompt: "", messages: [{ role: "user", content: prompt }] }, apiKey);
}

export async function callOpenAIWithContext(
  params: { systemPrompt: string; messages: { role: "user" | "assistant"; content: string }[] },
  apiKey: string
): Promise<string> {
  const out = await callOpenAIWithTools(
    { systemPrompt: params.systemPrompt, messages: params.messages, tools: [] },
    apiKey
  );
  return out.content ?? "";
}

export async function callOpenAIWithTools(
  params: { systemPrompt: string; messages: OpenAIMessageWithTools[]; tools: OpenAITool[] },
  apiKey: string
): Promise<{ content?: string; tool_calls?: OpenAIToolCall[] }> {
  const { systemPrompt, messages, tools } = params;
  const apiMessages: Record<string, unknown>[] = [];
  if (systemPrompt.trim()) apiMessages.push({ role: "system", content: systemPrompt });
  for (const m of messages) {
    if (m.role === "user" || m.role === "system") {
      apiMessages.push({ role: m.role, content: m.content });
    } else if (m.role === "assistant") {
      const msg: Record<string, unknown> = { role: "assistant", content: m.content || null };
      if (m.tool_calls?.length) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }
      apiMessages.push(msg);
    } else if (m.role === "tool") {
      apiMessages.push({ role: "tool", content: m.content, tool_call_id: m.tool_call_id });
    }
  }
  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages: apiMessages,
    max_tokens: 2048,
  };
  if (tools.length > 0) body.tools = tools;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${t}`);
  }
  const j = (await res.json()) as {
    choices?: { message?: { content?: string; tool_calls?: { id: string; function?: { name: string; arguments: string } }[] } }[];
  };
  const msg = j.choices?.[0]?.message;
  const content = msg?.content ?? undefined;
  const toolCalls = msg?.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function?.name ?? "",
    arguments: tc.function?.arguments ?? "{}",
  }));
  return {
    content: content ?? undefined,
    tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
  };
}

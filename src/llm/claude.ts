import type { ClaudeTool } from "./skill-to-tool-schema.js";

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

/** API 호출용: assistant는 content 블록 배열, user는 tool_result 블록 가능 */
export type ClaudeApiMessage =
  | { role: "user"; content: string | ClaudeUserContentBlock[] }
  | { role: "assistant"; content: ClaudeAssistantContentBlock[] };

type ClaudeUserContentBlock = { type: "text"; text: string } | { type: "tool_result"; tool_use_id: string; content: string };
type ClaudeAssistantContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export type ClaudeToolCall = { id: string; name: string; arguments: string };

export async function callClaude(prompt: string, apiKey: string): Promise<string> {
  return callClaudeWithContext({ systemPrompt: "", messages: [{ role: "user", content: prompt }] }, apiKey);
}

export async function callClaudeWithContext(
  params: { systemPrompt: string; messages: ClaudeMessage[] },
  apiKey: string
): Promise<string> {
  const out = await callClaudeWithTools(
    { systemPrompt: params.systemPrompt, messages: params.messages, tools: [] },
    apiKey
  );
  return out.content ?? "";
}

function toClaudeApiMessages(messages: ClaudeMessageWithTools[]): ClaudeApiMessage[] {
  const out: ClaudeApiMessage[] = [];
  let toolResultBuffer: ClaudeUserContentBlock[] = [];
  const flushToolResults = () => {
    if (toolResultBuffer.length > 0) {
      out.push({ role: "user", content: toolResultBuffer });
      toolResultBuffer = [];
    }
  };
  for (const m of messages) {
    if (m.role === "user") {
      flushToolResults();
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      flushToolResults();
      const blocks: ClaudeAssistantContentBlock[] = [];
      if (m.content?.trim()) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls ?? []) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.arguments || "{}");
        } catch {
          input = {};
        }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input });
      }
      if (blocks.length) out.push({ role: "assistant", content: blocks });
    } else if (m.role === "tool") {
      toolResultBuffer.push({ type: "tool_result", tool_use_id: m.tool_call_id ?? "", content: m.content });
    }
  }
  flushToolResults();
  return out;
}

export type ClaudeMessageWithTools =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ClaudeToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export async function callClaudeWithTools(
  params: { systemPrompt: string; messages: ClaudeMessageWithTools[]; tools: ClaudeTool[] },
  apiKey: string
): Promise<{ content?: string; tool_calls?: ClaudeToolCall[] }> {
  const { systemPrompt, messages, tools } = params;
  const apiMessages = toClaudeApiMessages(messages);
  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: apiMessages.map((m) => {
      if (m.role === "user") {
        const c = m.content;
        return { role: "user" as const, content: typeof c === "string" ? c : c };
      }
      return { role: m.role, content: m.content };
    }),
  };
  if (systemPrompt.trim()) body.system = systemPrompt;
  if (tools.length > 0) body.tools = tools;
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
  const j = (await res.json()) as {
    content?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
    stop_reason?: string;
  };
  const textParts = (j.content ?? [])
    .filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text);
  const toolCalls: ClaudeToolCall[] = (j.content ?? [])
    .filter((c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => c.type === "tool_use" && typeof c.id === "string")
    .map((c) => ({ id: c.id, name: c.name, arguments: JSON.stringify(c.input ?? {}) }));
  return {
    content: textParts.length ? textParts.join("") : undefined,
    tool_calls: toolCalls.length ? toolCalls : undefined,
  };
}

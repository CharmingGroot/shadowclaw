/**
 * Pi 스타일 에이전트 러너: 네이티브 tool calling 루프.
 * ReAct(JSON 파싱) 대신 API tools + tool_calls 기반으로 동작.
 */
import type { Message } from "./types.js";
import type { ModelKind } from "./llm/index.js";
import type { MessageWithTools, ToolCallSpec, CompleteWithToolsResult } from "./llm/index.js";
import { completeWithTools } from "./llm/index.js";
import { buildSystemPrompt } from "./prompts/agent-react.js";
import { resolveWorkspaceDir, loadContextFiles } from "./context-files.js";
import * as skillTools from "./tools/skill-tools.js";
import { registry } from "./skills/index.js";
import type { ToolCallResult } from "./types.js";

const MAX_STEPS = 10;

function historyToMessageWithTools(history: Message[]): MessageWithTools[] {
  const out: MessageWithTools[] = [];
  for (const m of history) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      let tool_calls: ToolCallSpec[] | undefined;
      if (m.tool_calls_json) {
        try {
          tool_calls = JSON.parse(m.tool_calls_json) as ToolCallSpec[];
        } catch {
          /* ignore */
        }
      }
      out.push({ role: "assistant", content: m.content, tool_calls });
    } else if (m.role === "tool") {
      out.push({
        role: "tool",
        content: m.content,
        tool_call_id: m.tool_call_id ?? `gen-${out.length}`,
      });
    }
  }
  return out;
}

function messageWithToolsToMessage(m: MessageWithTools): Message {
  if (m.role === "user") return { role: "user", content: m.content };
  if (m.role === "assistant") {
    const out: Message = { role: "assistant", content: m.content };
    if (m.tool_calls?.length) out.tool_calls_json = JSON.stringify(m.tool_calls);
    return out;
  }
  return { role: "tool", content: m.content, tool_call_id: m.tool_call_id };
}

async function executeToolCall(
  spec: ToolCallSpec,
  retryFailures: Map<string, number>
): Promise<{ content: string; toolCall: ToolCallResult }> {
  const argsKey = `${spec.name}:${spec.arguments}`;
  if ((retryFailures.get(argsKey) ?? 0) >= 3) {
    return {
      content: `[Reflection] ${spec.name} failed 3 times. Skipping.`,
      toolCall: { skill: spec.name, args: {}, error: "Skipped after 3 failures." },
    };
  }
  try {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(spec.arguments || "{}");
    } catch {
      args = {};
    }
    const result = await registry.run(spec.name, args);
    retryFailures.set(argsKey, 0);
    const obsStr = typeof result === "object" ? JSON.stringify(result) : String(result);
    const sanitized = obsStr.length > 2000 ? obsStr.slice(0, 2000) + "...(truncated)" : obsStr;
    return {
      content: sanitized,
      toolCall: { skill: spec.name, args, result_preview: obsStr.slice(0, 200) },
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    retryFailures.set(argsKey, (retryFailures.get(argsKey) ?? 0) + 1);
    return {
      content: `Error: ${errMsg}`,
      toolCall: { skill: spec.name, args: {}, error: errMsg },
    };
  }
}

export interface RunPiStyleOptions {
  model?: ModelKind;
  maxSteps?: number;
  forceSkill?: string;
}

export async function runPiStyle(
  userMessage: string,
  history: Message[],
  options: RunPiStyleOptions = {}
): Promise<{ content: string; tool_calls: ToolCallResult[]; messages: Message[] }> {
  const { model = "claude", maxSteps = MAX_STEPS, forceSkill } = options;
  const skillsList = skillTools.listSkills();
  const toolSummaries: Record<string, string> = Object.fromEntries(
    skillsList.map((s) => [s.name, (s.description || s.name).trim().slice(0, 80)])
  );
  const skillEntries = skillTools.listSkillsWithLocation();
  const workspaceDir = resolveWorkspaceDir();
  const contextFiles = await loadContextFiles(workspaceDir);
  const systemPrompt = buildSystemPrompt({
    toolSummaries,
    skillEntries,
    forceSkill,
    contextFiles,
    workspaceDir: workspaceDir || undefined,
    promptMode: "full",
    hasMemoryTools: false,
    useNativeTools: true,
  });

  let messages: MessageWithTools[] = [...historyToMessageWithTools(history), { role: "user", content: userMessage }];
  const runMessages: Message[] = [];
  const toolCallsResult: ToolCallResult[] = [];
  const retryFailures = new Map<string, number>();

  for (let step = 0; step < maxSteps; step++) {
    const result: CompleteWithToolsResult = await completeWithTools(
      { systemPrompt, messages, tools: skillsList },
      model
    );

    const assistantContent = result.content ?? "";
    const assistantToolCalls = result.tool_calls ?? [];
    const assistantMsg: MessageWithTools = {
      role: "assistant",
      content: assistantContent,
      tool_calls: assistantToolCalls.length ? assistantToolCalls : undefined,
    };
    messages.push(assistantMsg);
    runMessages.push(messageWithToolsToMessage(assistantMsg));

    if (!assistantToolCalls.length) {
      return {
        content: assistantContent.trim() || "응답을 생성하지 못했습니다.",
        tool_calls: toolCallsResult,
        messages: runMessages,
      };
    }

    for (const tc of assistantToolCalls) {
      const { content, toolCall } = await executeToolCall(tc, retryFailures);
      toolCallsResult.push(toolCall);
      messages.push({ role: "tool", content, tool_call_id: tc.id });
      runMessages.push({ role: "tool", content, tool_call_id: tc.id });
    }
  }

  return {
    content: "최대 단계에 도달했습니다. 지금까지 결과를 바탕으로 요약해 주세요.",
    tool_calls: toolCallsResult,
    messages: runMessages,
  };
}

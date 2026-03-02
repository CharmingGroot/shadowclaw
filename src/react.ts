/**
 * Agent loop (OpenClaw-style)
 *
 * messages[] = user/assistant/tool. 도구 결과는 role "tool"로 쌓고, API 호출 시 user 메시지로 변환.
 */
import type { Message, ToolCallResult } from "./types.js";
import type { ModelKind } from "./llm/index.js";
import * as skillTools from "./tools/skill-tools.js";
import { registry } from "./skills/index.js";
import { completeWithContext } from "./llm/index.js";
import { resolveWorkspaceDir, loadContextFiles } from "./context-files.js";
import {
  ACTION_CALL,
  ACTION_ANSWER,
  buildSystemPrompt,
  buildUserMessageContent,
  messagesToApiFormat,
} from "./prompts/agent-react.js";

const MAX_STEPS = 10;

function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = m ? m[1].trim() : text;
  const obj = raw.match(/\{[\s\S]*\}/);
  if (!obj) return null;
  try {
    return JSON.parse(obj[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Tool execution: run skill, return observation string (sanitized for size; OpenClaw: tool results sanitized before logging). */
async function executeTool(
  skillName: string,
  args: Record<string, unknown>,
  retryFailures: Map<string, number>
): Promise<{ observation: string; toolCall: ToolCallResult }> {
  const argsKey = `${skillName}:${JSON.stringify(args)}`;
  if ((retryFailures.get(argsKey) ?? 0) >= 3) {
    return {
      observation: `[Reflection] ${skillName} failed 3 times. Skipping.`,
      toolCall: { skill: skillName, args, error: "Skipped after 3 failures." },
    };
  }

  try {
    const result = await registry.run(skillName, args);
    retryFailures.set(argsKey, 0);
    const obsStr = typeof result === "object" ? JSON.stringify(result) : String(result);
    const sanitized = obsStr.length > 2000 ? obsStr.slice(0, 2000) + "...(truncated)" : obsStr;
    return {
      observation: sanitized,
      toolCall: { skill: skillName, args, result_preview: obsStr.slice(0, 200) },
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    retryFailures.set(argsKey, (retryFailures.get(argsKey) ?? 0) + 1);
    return {
      observation: `Error: ${errMsg}`,
      toolCall: { skill: skillName, args, error: errMsg },
    };
  }
}

export interface ReactOptions {
  /** Legacy: single prompt (used if model not provided). */
  llm?: (prompt: string) => Promise<string>;
  /** OpenClaw-style: system + messages. */
  model?: ModelKind;
  maxSteps?: number;
  forceSkill?: string;
}

export async function runReact(
  userMessage: string,
  history: Message[],
  options: ReactOptions
): Promise<{ content: string; tool_calls: ToolCallResult[]; messages: Message[] }> {
  const { llm: legacyLlm, model = "claude", maxSteps = MAX_STEPS, forceSkill } = options;

  const skillsList = skillTools.listSkills();
  const toolSummaries: Record<string, string> = Object.fromEntries(
    skillsList.map((s) => [s.name, (s.description || s.name).trim().slice(0, 80)])
  );
  const skillEntries = skillTools.listSkillsWithLocation();
  const skillParamsBlock = skillsList
    .map((s) => `${s.name}: ${JSON.stringify(s.params_schema ?? {})}`)
    .join("\n");

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
  });

  const userContent = buildUserMessageContent({ userMessage, skillParamsBlock });
  const messages: Message[] = [...history, { role: "user", content: userContent }];
  const runMessages: Message[] = [];

  const toolCalls: ToolCallResult[] = [];
  const retryFailures = new Map<string, number>();

  for (let step = 0; step < maxSteps; step++) {
    const apiMessages = messagesToApiFormat(messages);
    const response = legacyLlm
      ? await legacyLlm(systemPrompt + "\n\n" + apiMessages[apiMessages.length - 1]!.content)
      : await completeWithContext({ systemPrompt, messages: apiMessages }, model);
    const parsed = extractJson(response);

    const assistantMsg: Message = { role: "assistant", content: response };
    messages.push(assistantMsg);
    runMessages.push(assistantMsg);

    if (!parsed) {
      return {
        content: response.trim() || "응답을 생성하지 못했습니다.",
        tool_calls: toolCalls,
        messages: runMessages,
      };
    }

    const action = (parsed.action ?? parsed.Action) as string | undefined;

    if (action === ACTION_ANSWER) {
      const content = (parsed.content ?? parsed.Content ?? "") as string;
      return { content: content.trim(), tool_calls: toolCalls, messages: runMessages };
    }

    if (action === ACTION_CALL) {
      const skillName = (parsed.skill ?? parsed.Skill ?? "") as string;
      const args = (parsed.args ?? parsed.Args ?? {}) as Record<string, unknown>;
      if (!skillName) {
        const errObs = "Error: skill name missing.";
        messages.push({ role: "tool", content: errObs });
        runMessages.push({ role: "tool", content: errObs });
        continue;
      }

      const { observation, toolCall } = await executeTool(skillName, args, retryFailures);
      toolCalls.push(toolCall);
      messages.push({ role: "tool", content: observation });
      runMessages.push({ role: "tool", content: observation });
      continue;
    }

    const errObs = `Unknown action: ${action}. Use "${ACTION_CALL}" or "${ACTION_ANSWER}".`;
    messages.push({ role: "tool", content: errObs });
    runMessages.push({ role: "tool", content: errObs });
  }

  return {
    content: "최대 단계에 도달했습니다. 지금까지 결과를 바탕으로 요약해 주세요.",
    tool_calls: toolCalls,
    messages: runMessages,
  };
}

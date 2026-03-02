/**
 * Agent loop (OpenClaw-style)
 *
 * Single serialized run per invocation: intake (userMessage) → context assembly →
 * model inference → [tool execution → observation]×N → final reply.
 * No streaming/lifecycle events; returns content + tool_calls on completion.
 *
 * Ref: OpenClaw docs/concepts/agent-loop.md
 *   intake → context assembly → model inference → tool execution → streaming replies → persistence
 */
import type { Turn, ToolCallResult } from "./types.js";
import * as skillTools from "./tools/skill-tools.js";
import { registry } from "./skills/index.js";
import { ACTION_CALL, ACTION_ANSWER, buildAgentReactPrompt } from "./prompts/agent-react.js";

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
  llm: (prompt: string) => Promise<string>;
  maxSteps?: number;
  forceSkill?: string;
}

export async function runReact(
  userMessage: string,
  history: Turn[],
  options: ReactOptions
): Promise<{ content: string; tool_calls: ToolCallResult[] }> {
  const { llm, maxSteps = MAX_STEPS, forceSkill } = options;

  // Skills snapshot (OpenClaw: skills loaded and injected into prompt)
  const skillsList = skillTools.listSkills();
  const skillsDesc = skillsList
    .map((s) => `- ${s.name}: ${s.description} | params: ${JSON.stringify(s.params_schema)}`)
    .join("\n");

  const observations: string[] = [];
  const toolCalls: ToolCallResult[] = [];
  const retryFailures = new Map<string, number>();

  for (let step = 0; step < maxSteps; step++) {
    // Context assembly (prompt from src/prompts/)
    const prompt = buildAgentReactPrompt({
      userMessage,
      history,
      skillsDesc,
      observations,
      forceSkill,
    });

    // Model inference
    const response = await llm(prompt);
    const parsed = extractJson(response);

    if (!parsed) {
      return { content: response.trim() || "응답을 생성하지 못했습니다.", tool_calls: toolCalls };
    }

    const action = (parsed.action ?? parsed.Action) as string | undefined;

    // Final answer → return (end of loop)
    if (action === ACTION_ANSWER) {
      const content = (parsed.content ?? parsed.Content ?? "") as string;
      return { content: content.trim(), tool_calls: toolCalls };
    }

    // Tool call → execution → observation → next step
    if (action === ACTION_CALL) {
      const skillName = (parsed.skill ?? parsed.Skill ?? "") as string;
      const args = (parsed.args ?? parsed.Args ?? {}) as Record<string, unknown>;
      if (!skillName) {
        observations.push("Error: skill name missing.");
        continue;
      }

      const { observation, toolCall } = await executeTool(skillName, args, retryFailures);
      observations.push(observation);
      toolCalls.push(toolCall);
      continue;
    }

    observations.push(`Unknown action: ${action}. Use "${ACTION_CALL}" or "${ACTION_ANSWER}".`);
  }

  return {
    content: "최대 단계에 도달했습니다. 지금까지 결과를 바탕으로 요약해 주세요.",
    tool_calls: toolCalls,
  };
}

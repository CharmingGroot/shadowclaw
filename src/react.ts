import type { Turn, ToolCallResult } from "./types.js";
import * as skillTools from "./tools/skill-tools.js";
import { registry } from "./skills/index.js";

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

function buildPrompt(
  userMessage: string,
  history: Turn[],
  skillsDesc: string,
  observations: string[],
  forceSkill?: string
): string {
  const lines = [
    "You are a helpful assistant with access to skills (tools). Respond ONLY with a single JSON object.",
    "",
  ];
  if (forceSkill) {
    lines.push(`User requested to use skill "${forceSkill}". Prefer calling it with appropriate args.`, "");
  }
  lines.push(
    "Format 1 - Call a skill:",
    '{"thought": "reasoning", "action": "call", "skill": "<name>", "args": {...}}',
    "Format 2 - Final answer:",
    '{"thought": "reasoning", "action": "answer", "content": "<response in Korean or English>"}',
    "",
    "Available skills:",
    skillsDesc,
    "",
    "User message:",
    userMessage,
    ""
  );
  if (history.length) {
    lines.push("Recent conversation:");
    history.slice(-6).forEach((t) => {
      lines.push(`- ${t.role}: ${(t.content || "").slice(0, 300)}`);
    });
    lines.push("");
  }
  if (observations.length) {
    lines.push("Observations (last skill results):");
    observations.slice(-3).forEach((o, i) => {
      lines.push(`${i + 1}. ${String(o).slice(0, 1200)}`);
    });
    lines.push("");
  }
  lines.push("Respond with exactly one JSON object:");
  return lines.join("\n");
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
  const skillsList = skillTools.listSkills();
  const skillsDesc = skillsList
    .map((s) => `- ${s.name}: ${s.description} | params: ${JSON.stringify(s.params_schema)}`)
    .join("\n");

  const observations: string[] = [];
  const toolCalls: ToolCallResult[] = [];
  const retryFailures = new Map<string, number>();

  for (let step = 0; step < maxSteps; step++) {
    const prompt = buildPrompt(userMessage, history, skillsDesc, observations, forceSkill);
    const response = await llm(prompt);
    const parsed = extractJson(response);

    if (!parsed) {
      return { content: response.trim() || "응답을 생성하지 못했습니다.", tool_calls: toolCalls };
    }

    const action = (parsed.action ?? parsed.Action) as string | undefined;
    if (action === "answer") {
      const content = (parsed.content ?? parsed.Content ?? "") as string;
      return { content: content.trim(), tool_calls: toolCalls };
    }

    if (action === "call") {
      const skillName = (parsed.skill ?? parsed.Skill ?? "") as string;
      const args = (parsed.args ?? parsed.Args ?? {}) as Record<string, unknown>;
      if (!skillName) {
        observations.push("Error: skill name missing.");
        continue;
      }

      const argsKey = `${skillName}:${JSON.stringify(args)}`;
      if ((retryFailures.get(argsKey) ?? 0) >= 3) {
        observations.push(`[Reflection] ${skillName} failed 3 times. Skipping.`);
        continue;
      }

      try {
        const result = await registry.run(skillName, args);
        retryFailures.set(argsKey, 0);
        const obsStr = typeof result === "object" ? JSON.stringify(result) : String(result);
        observations.push(obsStr.length > 2000 ? obsStr.slice(0, 2000) + "...(truncated)" : obsStr);
        toolCalls.push({ skill: skillName, args, result_preview: obsStr.slice(0, 200) });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        retryFailures.set(argsKey, (retryFailures.get(argsKey) ?? 0) + 1);
        observations.push(`Error: ${errMsg}`);
        toolCalls.push({ skill: skillName, args, error: errMsg });
      }
      continue;
    }

    observations.push(`Unknown action: ${action}. Use "call" or "answer".`);
  }

  return {
    content: "최대 단계에 도달했습니다. 지금까지 결과를 바탕으로 요약해 주세요.",
    tool_calls: toolCalls,
  };
}

/**
 * 스킬 메타 → OpenAI/Claude API용 tools 배열 변환.
 * Pi/OpenClaw 스타일 네이티브 tool calling에서 사용.
 */
import type { SkillMeta } from "../types.js";

/** params_schema 값("string"|"number" 등) → JSON Schema type */
function schemaType(raw: string): string {
  const s = (raw ?? "").toLowerCase();
  if (["string", "number", "boolean", "object", "array"].includes(s)) return s;
  return "string";
}

/** OpenAI function tool 한 개 */
export type OpenAITool = {
  type: "function";
  function: { name: string; description: string; parameters: { type: "object"; properties: Record<string, { type: string; description?: string }>; required?: string[] } };
};

/** Claude tool 한 개 (Anthropic Messages API) */
export type ClaudeTool = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, { type: string; description?: string }>; required?: string[] };
};

export function skillToOpenAITool(meta: SkillMeta): OpenAITool {
  const params = meta.params_schema ?? {};
  const properties: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    properties[key] = { type: schemaType(val) };
    required.push(key);
  }
  return {
    type: "function",
    function: {
      name: meta.name,
      description: (meta.description || meta.name).trim().slice(0, 4096),
      parameters: { type: "object", properties, required: required.length ? required : undefined },
    },
  };
}

export function skillToClaudeTool(meta: SkillMeta): ClaudeTool {
  const params = meta.params_schema ?? {};
  const properties: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    properties[key] = { type: schemaType(val) };
    required.push(key);
  }
  return {
    name: meta.name,
    description: (meta.description || meta.name).trim().slice(0, 4096),
    input_schema: { type: "object", properties, required: required.length ? required : undefined },
  };
}

export function skillsToOpenAITools(metas: SkillMeta[]): OpenAITool[] {
  return metas.map(skillToOpenAITool);
}

export function skillsToClaudeTools(metas: SkillMeta[]): ClaudeTool[] {
  return metas.map(skillToClaudeTool);
}

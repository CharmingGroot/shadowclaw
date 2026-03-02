/**
 * 공통 타입 — 세션·턴·스킬 메타
 */
export interface Turn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tool_calls?: ToolCallResult[];
}

export interface ToolCallResult {
  skill: string;
  args: Record<string, unknown>;
  result_preview?: string;
  error?: string;
}

export interface SkillMeta {
  name: string;
  description: string;
  params_schema: Record<string, string>;
}

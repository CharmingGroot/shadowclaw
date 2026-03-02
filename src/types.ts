/**
 * 공통 타입 — 세션·턴·스킬 메타
 */

/** OpenClaw 스타일: 대화·도구 결과를 user/assistant/tool 메시지 열로 저장·전달 */
export interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp?: string;
  /** role이 tool일 때 API에 필요한 도구 호출 id (네이티브 tool calling) */
  tool_call_id?: string;
  /** role이 assistant일 때 호출한 도구 목록 (네이티브 tool calling, JSON 문자열 또는 직렬화용) */
  tool_calls_json?: string;
}

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

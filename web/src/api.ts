const BASE = "";

export interface Session {
  id: string;
  title: string;
  updated_at: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tool_calls?: { skill: string; args: Record<string, unknown>; result_preview?: string; error?: string }[];
}

export interface SkillMeta {
  name: string;
  description: string;
  params_schema: Record<string, string>;
  enabled?: boolean;
  require_hitl?: boolean;
  content?: string;
}

export interface McpServer {
  id: string;
  name?: string;
  url?: string;
  transport?: "stdio" | "http";
  tools?: { name: string; description?: string }[];
  updated_at: number;
}

export async function getSessions(): Promise<Session[]> {
  const res = await fetch(BASE + "/sessions");
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.sessions ?? [];
}

export async function createSession(title?: string): Promise<string> {
  const res = await fetch(BASE + "/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(title != null ? { title } : {}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.session_id;
}

export async function getSession(id: string): Promise<{ session_id: string; title: string; updated_at: number; messages: Message[] }> {
  const res = await fetch(BASE + "/sessions/" + id);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(BASE + "/sessions/" + id, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  const res = await fetch(BASE + "/sessions/" + id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getSkills(includeDisabled?: boolean): Promise<SkillMeta[]> {
  const url = includeDisabled ? BASE + "/skills?include_disabled=1" : BASE + "/skills";
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.skills ?? [];
}

export async function getSkill(name: string): Promise<SkillMeta & { content?: string }> {
  const res = await fetch(BASE + "/skills/" + encodeURIComponent(name));
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchSkill(
  name: string,
  body: { description?: string; require_hitl?: boolean; enabled?: boolean; content?: string }
): Promise<{ ok: boolean }> {
  const res = await fetch(BASE + "/skills/" + encodeURIComponent(name), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMcpServers(): Promise<McpServer[]> {
  const res = await fetch(BASE + "/mcp/servers");
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.servers ?? [];
}

export async function addMcpServer(entry: {
  name?: string;
  url?: string;
  transport?: "stdio" | "http";
  tools?: { name: string; description?: string }[];
}): Promise<McpServer> {
  const res = await fetch(BASE + "/mcp/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteMcpServer(id: string): Promise<void> {
  const res = await fetch(BASE + "/mcp/servers/" + id, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function getMcpServerTools(id: string): Promise<{ name: string; description?: string }[]> {
  const res = await fetch(BASE + "/mcp/servers/" + id + "/tools");
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.tools ?? [];
}

/** API Key는 서버 환경변수(ANTHROPIC_API_KEY, OPENAI_API_KEY)로만 설정. 클라이언트에서 전달하지 않음. */
export async function sendChat(
  content: string,
  sessionId: string | null,
  opts?: { force_skill?: string; model?: "claude" | "gpt" }
): Promise<{ session_id: string; content: string; tool_calls: unknown[] }> {
  const body: { content: string; session_id?: string; force_skill?: string; model?: string } = { content };
  if (sessionId) body.session_id = sessionId;
  if (opts?.force_skill) body.force_skill = opts.force_skill;
  if (opts?.model) body.model = opts.model;
  const res = await fetch(BASE + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const SETTINGS_KEY = "shadowclaw_settings";

export interface AppSettings {
  provider?: "claude" | "gpt";
}

export function loadSettings(): AppSettings {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    return s ? (JSON.parse(s) as AppSettings) : {};
  } catch {
    return {};
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

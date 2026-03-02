import type { SkillMeta } from "../types.js";
import * as registry from "../skills/registry.js";

const overrides = new Map<
  string,
  { description?: string; require_hitl?: boolean; enabled?: boolean; content?: string }
>();

function defaultMarkdown(meta: SkillMeta): string {
  const params = Object.keys(meta.params_schema ?? {}).length
    ? "\n\n## params_schema\n\n```json\n" + JSON.stringify(meta.params_schema, null, 2) + "\n```"
    : "";
  return `# ${meta.name}\n\n${meta.description ?? ""}${params}`;
}

function applyOverride(meta: SkillMeta): SkillMeta & { require_hitl?: boolean; enabled?: boolean; content?: string } {
  const o = overrides.get(meta.name);
  const base = { ...meta, enabled: true };
  const content = o?.content ?? defaultMarkdown(meta);
  if (!o) return { ...base, content };
  return {
    ...base,
    ...(o.description !== undefined && { description: o.description }),
    ...(o.require_hitl !== undefined && { require_hitl: o.require_hitl }),
    ...(o.enabled !== undefined && { enabled: o.enabled }),
    content,
  };
}

export function listSkills(opts?: { includeDisabled?: boolean }): (SkillMeta & { require_hitl?: boolean; enabled?: boolean })[] {
  const list = registry.listSkills().map(applyOverride);
  if (opts?.includeDisabled) return list;
  return list.filter((s) => (s as { enabled?: boolean }).enabled !== false);
}

export function getSkill(args: { name: string }): {
  skill: (SkillMeta & { require_hitl?: boolean; enabled?: boolean; content?: string }) | null;
} {
  const name = String(args?.name ?? "").trim();
  if (!name) return { skill: null };
  const entry = registry.get(name);
  if (!entry) return { skill: null };
  return { skill: applyOverride(entry.meta) };
}

export function getSkillContent(name: string): string {
  const entry = registry.get(name);
  if (!entry) return "";
  const o = overrides.get(name);
  return o?.content ?? defaultMarkdown(entry.meta);
}

export function updateSkillContent(name: string, content: string): { ok: boolean } | { error: string } {
  const n = String(name ?? "").trim();
  if (!n) return { error: "name is required" };
  if (registry.get(n) == null) return { error: `Skill not found: ${n}` };
  const current = overrides.get(n) ?? {};
  overrides.set(n, { ...current, content });
  return { ok: true };
}

export function updateSkillMeta(args: {
  name: string;
  description?: string;
  require_hitl?: boolean;
  enabled?: boolean;
  content?: string;
}): { ok: boolean } | { error: string } {
  const name = String(args?.name ?? "").trim();
  if (!name) return { error: "name is required" };
  if (registry.get(name) == null) return { error: `Skill not found: ${name}` };
  const o: { description?: string; require_hitl?: boolean; enabled?: boolean; content?: string } = {};
  if (args.description !== undefined) o.description = String(args.description);
  if (args.require_hitl !== undefined) o.require_hitl = Boolean(args.require_hitl);
  if (args.enabled !== undefined) o.enabled = Boolean(args.enabled);
  if (args.content !== undefined) o.content = String(args.content);
  const current = overrides.get(name) ?? {};
  overrides.set(name, { ...current, ...o });
  return { ok: true };
}

export function createCustomSkill(args: {
  name: string;
  description: string;
  params_schema: Record<string, string>;
}): { ok: boolean } | { error: string } {
  const name = String(args?.name ?? "").trim();
  if (!name) return { error: "name is required" };
  if (registry.get(name) != null) return { error: `Skill already exists: ${name}` };
  const description = String(args?.description ?? "").trim();
  const params_schema =
    typeof args?.params_schema === "object" && args.params_schema != null ? (args.params_schema as Record<string, string>) : {};
  registry.register(
    name,
    description || "Custom skill (no description).",
    params_schema,
    async () => ({ message: "Custom skill; no implementation bound." })
  );
  return { ok: true };
}

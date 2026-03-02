import type { SkillMeta } from "../types.js";
import * as registry from "../skills/registry.js";

const overrides = new Map<string, { description?: string; require_hitl?: boolean; enabled?: boolean }>();

function applyOverride(meta: SkillMeta): SkillMeta & { require_hitl?: boolean; enabled?: boolean } {
  const o = overrides.get(meta.name);
  if (!o) return { ...meta, enabled: true };
  return {
    ...meta,
    ...(o.description !== undefined && { description: o.description }),
    ...(o.require_hitl !== undefined && { require_hitl: o.require_hitl }),
    ...(o.enabled !== undefined && { enabled: o.enabled }),
  };
}

export function listSkills(): SkillMeta[] {
  return registry.listSkills().map(applyOverride);
}

export function getSkill(args: { name: string }): { skill: (SkillMeta & { require_hitl?: boolean; enabled?: boolean }) | null } {
  const name = String(args?.name ?? "").trim();
  if (!name) return { skill: null };
  const entry = registry.get(name);
  if (!entry) return { skill: null };
  return { skill: applyOverride(entry.meta) };
}

export function updateSkillMeta(args: {
  name: string;
  description?: string;
  require_hitl?: boolean;
  enabled?: boolean;
}): { ok: boolean } | { error: string } {
  const name = String(args?.name ?? "").trim();
  if (!name) return { error: "name is required" };
  if (registry.get(name) == null) return { error: `Skill not found: ${name}` };
  const o: { description?: string; require_hitl?: boolean; enabled?: boolean } = {};
  if (args.description !== undefined) o.description = String(args.description);
  if (args.require_hitl !== undefined) o.require_hitl = Boolean(args.require_hitl);
  if (args.enabled !== undefined) o.enabled = Boolean(args.enabled);
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

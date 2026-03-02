/**
 * Skill 레지스트리 — 이름·설명·파라미터·실행 함수 등록
 */
import type { SkillMeta } from "../types.js";

type SkillFn = (args: Record<string, unknown>) => Promise<unknown> | unknown;

const registry = new Map<string, { meta: SkillMeta; fn: SkillFn }>();

export function register(
  name: string,
  description: string,
  params_schema: Record<string, string>,
  fn: SkillFn
): void {
  registry.set(name, { meta: { name, description, params_schema }, fn });
}

export function unregister(name: string): boolean {
  return registry.delete(name);
}

export function get(name: string): { meta: SkillMeta; fn: SkillFn } | undefined {
  return registry.get(name);
}

export function listSkills(): SkillMeta[] {
  return Array.from(registry.values()).map((r) => r.meta);
}

export function run(name: string, args: Record<string, unknown>): Promise<unknown> {
  const entry = registry.get(name);
  if (!entry) return Promise.reject(new Error(`Unknown skill: ${name}`));
  return Promise.resolve(entry.fn(args ?? {})).catch((e) => {
    throw e;
  });
}

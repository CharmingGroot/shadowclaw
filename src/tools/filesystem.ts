import fs from "fs/promises";
import path from "path";
import { getSkillContent } from "./skill-tools.js";

const BASE_PATH = path.resolve(process.env.SHADOWCLAW_BASE_PATH ?? process.cwd());

/** OpenClaw 스타일: SKILL.md 본문을 가상 경로로 노출. read_file({ path: "skills/<name>.md" }) → 해당 스킬 마크다운. */
const SKILLS_VIRTUAL_PREFIX = "skills/";

function resolveAndValidate(relativePath: string): string {
  const resolved = path.resolve(BASE_PATH, relativePath);
  const baseResolved = path.resolve(BASE_PATH);
  const rel = path.relative(baseResolved, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path outside allowed base: ${relativePath}`);
  }
  return resolved;
}

export async function readFile(args: { path: string }): Promise<{ content: string } | { error: string }> {
  const rawPath = (args.path ?? "").trim().replace(/\\/g, "/");
  if (rawPath.startsWith(SKILLS_VIRTUAL_PREFIX) && rawPath.endsWith(".md")) {
    const name = rawPath.slice(SKILLS_VIRTUAL_PREFIX.length, -3).replace(/\/$/, "");
    if (!name) return { error: "Invalid skill path" };
    const content = getSkillContent(name);
    if (!content) return { error: `Skill not found: ${name}` };
    return { content };
  }
  try {
    const filePath = resolveAndValidate(args.path);
    const content = await fs.readFile(filePath, "utf-8");
    return { content };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function writeFile(args: { path: string; content: string }): Promise<{ ok: boolean } | { error: string }> {
  try {
    const filePath = resolveAndValidate(args.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, args.content, "utf-8");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function listDir(args: { path: string }): Promise<{ entries: { name: string; type: "file" | "dir" }[] } | { error: string }> {
  try {
    const dirPath = resolveAndValidate(args.path);
    const names = await fs.readdir(dirPath);
    const entries: { name: string; type: "file" | "dir" }[] = [];
    for (const name of names) {
      const full = path.join(dirPath, name);
      const stat = await fs.stat(full);
      entries.push({ name, type: stat.isDirectory() ? "dir" : "file" });
    }
    return { entries };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fileExists(args: { path: string }): Promise<{ exists: boolean } | { error: string }> {
  try {
    const filePath = resolveAndValidate(args.path);
    await fs.stat(filePath);
    return { exists: true };
  } catch {
    return { exists: false };
  }
}

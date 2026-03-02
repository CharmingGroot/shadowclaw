import fs from "fs/promises";
import path from "path";

const BASE_PATH = path.resolve(process.env.SHADOWCLAW_BASE_PATH ?? process.cwd());

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

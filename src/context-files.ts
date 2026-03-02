/**
 * OpenClaw-style context files (bootstrap): 워크스페이스에서 허용된 md 파일을 읽어
 * 용량 제한을 적용한 뒤 시스템 프롬프트에 넣는다.
 */
import fs from "node:fs/promises";
import path from "node:path";

export type EmbeddedContextFile = { path: string; content: string };

/** 허용된 bootstrap 파일명 (OpenClaw와 동일한 이름 사용). AGENTS.md = 워크스페이스/에이전트 설명 한 편 → 통째로 컨텍스트. */
export const BOOTSTRAP_FILENAMES = [
  "AGENTS.md",
  "SOUL.md",
  "USER.md",
  "MEMORY.md",
  "IDENTITY.md",
] as const;

export const DEFAULT_BOOTSTRAP_MAX_CHARS = 20_000;
export const DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS = 150_000;
const MAX_READ_BYTES = 2 * 1024 * 1024; // 2MB per file
const BOOTSTRAP_HEAD_RATIO = 0.7;
const BOOTSTRAP_TAIL_RATIO = 0.2;
const MIN_BOOTSTRAP_FILE_BUDGET_CHARS = 64;

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

function sliceUtf16Safe(input: string, start: number, end?: number): string {
  const len = input.length;
  let from = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
  let to = end === undefined ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
  if (to < from) {
    [from, to] = [to, from];
  }
  if (from > 0 && from < len) {
    const codeUnit = input.charCodeAt(from);
    if (isLowSurrogate(codeUnit) && isHighSurrogate(input.charCodeAt(from - 1))) from += 1;
  }
  if (to > 0 && to < len) {
    const codeUnit = input.charCodeAt(to - 1);
    if (isHighSurrogate(codeUnit) && isLowSurrogate(input.charCodeAt(to))) to -= 1;
  }
  return input.slice(from, to);
}

function truncateUtf16Safe(input: string, maxLen: number): string {
  const limit = Math.max(0, Math.floor(maxLen));
  if (input.length <= limit) return input;
  return sliceUtf16Safe(input, 0, limit);
}

function trimBootstrapContent(
  content: string,
  fileName: string,
  maxChars: number
): { content: string; truncated: boolean; originalLength: number } {
  const trimmed = content.trimEnd();
  if (trimmed.length <= maxChars) {
    return { content: trimmed, truncated: false, originalLength: trimmed.length };
  }
  const headChars = Math.floor(maxChars * BOOTSTRAP_HEAD_RATIO);
  const tailChars = Math.floor(maxChars * BOOTSTRAP_TAIL_RATIO);
  const head = trimmed.slice(0, headChars);
  const tail = trimmed.slice(-tailChars);
  const marker = [
    "",
    `[...truncated, read ${fileName} for full content...]`,
    `…(truncated ${fileName}: kept ${headChars}+${tailChars} chars of ${trimmed.length})…`,
    "",
  ].join("\n");
  return {
    content: [head, marker, tail].join("\n"),
    truncated: true,
    originalLength: trimmed.length,
  };
}

function clampToBudget(content: string, budget: number): string {
  if (budget <= 0) return "";
  if (content.length <= budget) return content;
  if (budget <= 3) return truncateUtf16Safe(content, budget);
  return `${truncateUtf16Safe(content, budget - 1)}…`;
}

/**
 * 워크스페이스 디렉터리 결정: SHADOWCLAW_WORKSPACE_DIR 또는 process.cwd()
 */
export function resolveWorkspaceDir(): string {
  const env = process.env.SHADOWCLAW_WORKSPACE_DIR?.trim();
  if (env) return path.resolve(process.cwd(), env);
  return process.cwd();
}

/**
 * 워크스페이스에서 bootstrap 파일만 읽어, 파일별/전체 용량 제한을 적용한
 * EmbeddedContextFile[] 반환. (OpenClaw buildBootstrapContextFiles + load 동일 개념)
 */
export async function loadContextFiles(
  workspaceDir: string,
  opts?: {
    maxChars?: number;
    totalMaxChars?: number;
  }
): Promise<EmbeddedContextFile[]> {
  const maxChars = opts?.maxChars ?? DEFAULT_BOOTSTRAP_MAX_CHARS;
  const totalMaxChars =
    opts?.totalMaxChars ?? Math.max(maxChars, DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS);
  const resolvedRoot = path.resolve(workspaceDir);
  const result: EmbeddedContextFile[] = [];
  let remainingTotalChars = totalMaxChars;

  for (const name of BOOTSTRAP_FILENAMES) {
    if (remainingTotalChars < MIN_BOOTSTRAP_FILE_BUDGET_CHARS) break;

    const filePath = path.join(resolvedRoot, name);
    const rel = path.relative(resolvedRoot, path.resolve(resolvedRoot, name));
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;

    let raw: string;
    try {
      const buf = await fs.readFile(filePath, { encoding: "utf-8", flag: "r" });
      raw = typeof buf === "string" ? buf : String(buf);
      if (Buffer.byteLength(raw, "utf-8") > MAX_READ_BYTES) {
        raw = Buffer.from(raw, "utf-8").subarray(0, MAX_READ_BYTES).toString("utf-8");
        raw = raw.replace(/\uFFFD$/g, "").trimEnd();
      }
    } catch {
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) continue;

    const fileMaxChars = Math.max(1, Math.min(maxChars, remainingTotalChars));
    const { content: trimmedContent } = trimBootstrapContent(trimmed, name, fileMaxChars);
    const contentWithinBudget = clampToBudget(trimmedContent, remainingTotalChars);
    if (!contentWithinBudget) continue;

    remainingTotalChars = Math.max(0, remainingTotalChars - contentWithinBudget.length);
    result.push({ path: filePath, content: contentWithinBudget });
  }

  return result;
}

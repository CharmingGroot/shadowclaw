/**
 * 톤/페르소나용 마크다운 로드 (SOUL.md 등).
 * @deprecated 메인 에이전트는 context-files(loadContextFiles) + Project Context 사용. 단일 파일 로드가 필요할 때만 사용.
 */
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_FILENAME = "SOUL.md";
const MAX_BYTES = 32 * 1024; // 32KB

/**
 * SOUL.md(또는 지정 경로)를 읽어 톤/페르소나 문자열을 반환한다.
 * @param customPath - 테스트용 등으로 경로를 직접 지정할 때 사용. 없으면 env 또는 cwd/SOUL.md
 * @returns 파일 내용(trim, 최대 32KB). 없거나 실패 시 undefined
 */
export async function loadTonePersonaMd(customPath?: string): Promise<string | undefined> {
  const resolved =
    customPath ?? process.env.SHADOWCLAW_SOUL_PATH?.trim() ?? path.join(process.cwd(), DEFAULT_FILENAME);
  const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(process.cwd(), resolved);

  try {
    const buf = await fs.readFile(absolute, { encoding: "utf-8", flag: "r" });
    const str = typeof buf === "string" ? buf : String(buf);
    const trimmed = str.trim();
    if (!trimmed) return undefined;
    const truncated =
      Buffer.byteLength(trimmed, "utf-8") > MAX_BYTES
        ? Buffer.from(trimmed, "utf-8").subarray(0, MAX_BYTES).toString("utf-8").replace(/\uFFFD$/g, "").trim()
        : trimmed;
    return truncated || undefined;
  } catch {
    return undefined;
  }
}

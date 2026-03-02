import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadTonePersonaMd } from "./tone-persona.js";

describe("loadTonePersonaMd", () => {
  let tmpDir: string;
  let origEnv: string | undefined;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `soul-md-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    origEnv = process.env.SHADOWCLAW_SOUL_PATH;
    delete process.env.SHADOWCLAW_SOUL_PATH;
  });

  afterEach(async () => {
    if (origEnv !== undefined) process.env.SHADOWCLAW_SOUL_PATH = origEnv;
    else delete process.env.SHADOWCLAW_SOUL_PATH;
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns file content when customPath points to existing file", async () => {
    const soulPath = path.join(tmpDir, "SOUL.md");
    await fs.writeFile(soulPath, "앞으로 모든 답변의 어투는 --했습니다용~!", "utf-8");
    const content = await loadTonePersonaMd(soulPath);
    expect(content).toBe("앞으로 모든 답변의 어투는 --했습니다용~!");
  });

  it("returns undefined when file does not exist", async () => {
    const content = await loadTonePersonaMd(path.join(tmpDir, "nonexistent.md"));
    expect(content).toBeUndefined();
  });

  it("trims whitespace", async () => {
    const soulPath = path.join(tmpDir, "SOUL.md");
    await fs.writeFile(soulPath, "\n\n  톤 지시 \n\n", "utf-8");
    const content = await loadTonePersonaMd(soulPath);
    expect(content).toBe("톤 지시");
  });

  it("returns undefined for empty file", async () => {
    const soulPath = path.join(tmpDir, "SOUL.md");
    await fs.writeFile(soulPath, "", "utf-8");
    const content = await loadTonePersonaMd(soulPath);
    expect(content).toBeUndefined();
  });
});

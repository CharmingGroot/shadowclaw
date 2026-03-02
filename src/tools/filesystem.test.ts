import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import "../skills/index.js"; // populate registry so skills/<name>.md has content
import * as filesystem from "./filesystem.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shadowclaw-"));
  process.env.SHADOWCLAW_BASE_PATH = tmpDir;
});

afterEach(async () => {
  delete process.env.SHADOWCLAW_BASE_PATH;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("filesystem tools", () => {
  it("write_file and read_file", async () => {
    const out = await filesystem.writeFile({ path: "a.txt", content: "hello" });
    expect("error" in out ? out.error : out.ok).toBe(true);
    const read = await filesystem.readFile({ path: "a.txt" });
    expect("error" in read ? read : read.content).toBe("hello");
  });

  it("list_dir", async () => {
    await filesystem.writeFile({ path: "f1.txt", content: "1" });
    await filesystem.writeFile({ path: "sub/dir.txt", content: "2" });
    const list = await filesystem.listDir({ path: "." });
    if ("error" in list) throw new Error(list.error);
    expect(list.entries.length).toBeGreaterThanOrEqual(2);
    const names = list.entries.map((e) => e.name);
    expect(names).toContain("f1.txt");
    expect(names).toContain("sub");
  });

  it("file_exists", async () => {
    await filesystem.writeFile({ path: "exist.txt", content: "x" });
    const r = await filesystem.fileExists({ path: "exist.txt" });
    expect("error" in r ? r : r.exists).toBe(true);
    const r2 = await filesystem.fileExists({ path: "nonexistent.txt" });
    expect("error" in r2 ? r2 : r2.exists).toBe(false);
  });

  it("rejects path outside base", async () => {
    const read = await filesystem.readFile({ path: "../../etc/passwd" });
    expect("error" in read).toBe(true);
  });

  it("read_file with virtual path skills/<name>.md returns skill SKILL.md content when skill exists", async () => {
    const r = await filesystem.readFile({ path: "skills/read_file.md" });
    expect("error" in r).toBe(false);
    expect((r as { content: string }).content).toContain("read_file");
  });

  it("read_file with virtual path skills/<name>.md returns error when skill not found", async () => {
    const r = await filesystem.readFile({ path: "skills/nonexistent_skill_xyz.md" });
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toContain("not found");
  });
});

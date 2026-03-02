import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  resolveWorkspaceDir,
  loadContextFiles,
  BOOTSTRAP_FILENAMES,
  DEFAULT_BOOTSTRAP_MAX_CHARS,
  DEFAULT_BOOTSTRAP_TOTAL_MAX_CHARS,
} from "./context-files.js";

describe("context-files", () => {
  it("BOOTSTRAP_FILENAMES includes AGENTS.md (OpenClaw-style workspace/agent description)", () => {
    expect(BOOTSTRAP_FILENAMES).toContain("AGENTS.md");
  });

  describe("resolveWorkspaceDir", () => {
    it("returns cwd when SHADOWCLAW_WORKSPACE_DIR is unset", () => {
      const orig = process.env.SHADOWCLAW_WORKSPACE_DIR;
      delete process.env.SHADOWCLAW_WORKSPACE_DIR;
      const dir = resolveWorkspaceDir();
      expect(path.isAbsolute(dir)).toBe(true);
      if (orig !== undefined) process.env.SHADOWCLAW_WORKSPACE_DIR = orig;
    });

    it("resolves SHADOWCLAW_WORKSPACE_DIR relative to cwd", () => {
      const cwd = process.cwd();
      process.env.SHADOWCLAW_WORKSPACE_DIR = ".";
      expect(resolveWorkspaceDir()).toBe(path.resolve(cwd, "."));
      process.env.SHADOWCLAW_WORKSPACE_DIR = "data";
      expect(resolveWorkspaceDir()).toBe(path.resolve(cwd, "data"));
      delete process.env.SHADOWCLAW_WORKSPACE_DIR;
    });
  });

  describe("loadContextFiles", () => {
    it("returns empty array when workspace has no bootstrap files", async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "shadowclaw-ctx-"));
      try {
        const files = await loadContextFiles(tmp);
        expect(files).toEqual([]);
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it("loads SOUL.md and injects content with path", async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "shadowclaw-ctx-"));
      try {
        await fs.writeFile(path.join(tmp, "SOUL.md"), "Be dark and concise.\n", "utf-8");
        const files = await loadContextFiles(tmp);
        expect(files).toHaveLength(1);
        expect(files[0].path).toContain("SOUL.md");
        expect(files[0].content).toContain("Be dark and concise");
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it("loads AGENTS.md when present (OpenClaw-style workspace/agent description)", async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "shadowclaw-ctx-"));
      try {
        await fs.writeFile(path.join(tmp, "AGENTS.md"), "This agent helps with tasks.\n", "utf-8");
        const files = await loadContextFiles(tmp);
        expect(files).toHaveLength(1);
        expect(files[0].path).toContain("AGENTS.md");
        expect(files[0].content).toContain("This agent helps with tasks");
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it("loads only allowed BOOTSTRAP_FILENAMES", async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "shadowclaw-ctx-"));
      try {
        await fs.writeFile(path.join(tmp, "SOUL.md"), "soul", "utf-8");
        await fs.writeFile(path.join(tmp, "USER.md"), "user", "utf-8");
        await fs.writeFile(path.join(tmp, "OTHER.md"), "other", "utf-8");
        const files = await loadContextFiles(tmp);
        const names = files.map((f) => path.basename(f.path));
        expect(names).toContain("SOUL.md");
        expect(names).toContain("USER.md");
        expect(names).not.toContain("OTHER.md");
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it("applies per-file max chars (truncation)", async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "shadowclaw-ctx-"));
      try {
        const big = "x".repeat(DEFAULT_BOOTSTRAP_MAX_CHARS + 5000);
        await fs.writeFile(path.join(tmp, "SOUL.md"), big, "utf-8");
        const files = await loadContextFiles(tmp, { maxChars: 500 });
        expect(files).toHaveLength(1);
        expect(files[0].content.length).toBeLessThanOrEqual(600);
        expect(files[0].content).toContain("truncated");
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    });

    it("BOOTSTRAP_FILENAMES includes SOUL and USER", () => {
      expect(BOOTSTRAP_FILENAMES).toContain("SOUL.md");
      expect(BOOTSTRAP_FILENAMES).toContain("USER.md");
    });
  });
});

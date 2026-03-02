import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runCommand(args: {
  command: string;
  timeout_sec?: number;
}): Promise<{ stdout: string; stderr: string; exitCode: number } | { error: string }> {
  const command = String(args.command ?? "").trim();
  if (!command) return { error: "command is required" };
  const timeoutMs = Math.min(Math.max(1, Number(args.timeout_sec ?? 30)) * 1000, 300_000);
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
    return { stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? ""),
      exitCode: typeof err.code === "number" ? err.code : 1,
    };
  }
}

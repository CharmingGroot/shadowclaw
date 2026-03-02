import { describe, it, expect } from "vitest";
import * as linux from "./linux.js";

describe("linux tools", () => {
  it("runCommand returns stdout", async () => {
    const cmd = process.platform === "win32" ? "echo 1" : "echo 1";
    const r = await linux.runCommand({ command: cmd, timeout_sec: 5 });
    if ("error" in r) throw new Error(r.error);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe("1");
  });

  it("runCommand empty command returns error", async () => {
    const r = await linux.runCommand({ command: "" });
    expect("error" in r).toBe(true);
  });
});

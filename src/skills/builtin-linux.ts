import * as registry from "./registry.js";
import * as linuxTools from "../tools/linux.js";

registry.register(
  "run_shell_command",
  "Run a shell command. Returns stdout, stderr, exitCode. timeout_sec defaults to 30.",
  { command: "string", timeout_sec: "number" },
  async (args) => linuxTools.runCommand(args as { command: string; timeout_sec?: number })
);

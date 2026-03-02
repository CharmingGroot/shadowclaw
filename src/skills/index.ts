import * as registry from "./registry.js";
import * as fsTools from "../tools/filesystem.js";
import * as linuxTools from "../tools/linux.js";
import * as skillTools from "../tools/skill-tools.js";

registry.register(
  "read_file",
  "Read text content of a file. Path relative to allowed base. UTF-8.",
  { path: "string" },
  async (args) => fsTools.readFile(args as { path: string })
);

registry.register(
  "write_file",
  "Write text content to a file (overwrite). Path relative to allowed base.",
  { path: "string", content: "string" },
  async (args) => fsTools.writeFile(args as { path: string; content: string })
);

registry.register(
  "list_dir",
  "List directory entries (name and type: file or dir). Path relative to allowed base.",
  { path: "string" },
  async (args) => fsTools.listDir(args as { path: string })
);

registry.register(
  "file_exists",
  "Check if a file or directory exists. Path relative to allowed base.",
  { path: "string" },
  async (args) => fsTools.fileExists(args as { path: string })
);

registry.register(
  "run_shell_command",
  "Run a shell command. Returns stdout, stderr, exitCode. timeout_sec defaults to 30.",
  { command: "string", timeout_sec: "number" },
  async (args) => linuxTools.runCommand(args as { command: string; timeout_sec?: number })
);

registry.register(
  "list_skills_meta",
  "List available skills (name, description, params). Includes overrides.",
  {},
  async () => skillTools.listSkills()
);

registry.register(
  "get_skill",
  "Get one skill metadata by name. Returns null if not found.",
  { name: "string" },
  async (args) => skillTools.getSkill(args as { name: string })
);

registry.register(
  "update_skill_meta",
  "Update skill meta override: description, require_hitl, enabled.",
  { name: "string", description: "string", require_hitl: "boolean", enabled: "boolean" },
  async (args) =>
    skillTools.updateSkillMeta(
      args as { name: string; description?: string; require_hitl?: boolean; enabled?: boolean }
    )
);

registry.register(
  "create_custom_skill",
  "Register a custom skill (meta only). Execution returns placeholder until bound.",
  { name: "string", description: "string", params_schema: "object" },
  async (args) =>
    skillTools.createCustomSkill(args as { name: string; description: string; params_schema: Record<string, string> })
);

export const HITL_SKILLS = new Set<string>();
export { registry };

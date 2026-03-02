import * as registry from "./registry.js";
import * as skillTools from "../tools/skill-tools.js";

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
  "Update skill meta override: description, require_hitl, enabled, content (markdown body).",
  { name: "string", description: "string", require_hitl: "boolean", enabled: "boolean", content: "string" },
  async (args) =>
    skillTools.updateSkillMeta(
      args as { name: string; description?: string; require_hitl?: boolean; enabled?: boolean; content?: string }
    )
);

registry.register(
  "create_custom_skill",
  "Register a custom skill (meta only). Execution returns placeholder until bound.",
  { name: "string", description: "string", params_schema: "object" },
  async (args) =>
    skillTools.createCustomSkill(args as { name: string; description: string; params_schema: Record<string, string> })
);

registry.register(
  "delete_custom_skill",
  "Delete a custom skill by name. Built-in skills cannot be deleted.",
  { name: "string" },
  async (args) => skillTools.deleteCustomSkill(args as { name: string })
);

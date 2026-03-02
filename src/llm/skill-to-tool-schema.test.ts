import { describe, it, expect } from "vitest";
import {
  skillToOpenAITool,
  skillToClaudeTool,
  skillsToOpenAITools,
  skillsToClaudeTools,
} from "./skill-to-tool-schema.js";

describe("skill-to-tool-schema", () => {
  it("skillToOpenAITool produces OpenAI function tool shape", () => {
    const meta = {
      name: "read_file",
      description: "Read file contents",
      params_schema: { path: "string", limit: "number" },
    };
    const t = skillToOpenAITool(meta);
    expect(t.type).toBe("function");
    expect(t.function.name).toBe("read_file");
    expect(t.function.description).toContain("Read file");
    expect(t.function.parameters.type).toBe("object");
    expect(t.function.parameters.properties.path.type).toBe("string");
    expect(t.function.parameters.properties.limit.type).toBe("number");
    expect(t.function.parameters.required).toEqual(["path", "limit"]);
  });

  it("skillToClaudeTool produces Claude input_schema shape", () => {
    const meta = {
      name: "echo",
      description: "Echoes input",
      params_schema: { text: "string" },
    };
    const t = skillToClaudeTool(meta);
    expect(t.name).toBe("echo");
    expect(t.description).toContain("Echoes");
    expect(t.input_schema.type).toBe("object");
    expect(t.input_schema.properties.text.type).toBe("string");
    expect(t.input_schema.required).toEqual(["text"]);
  });

  it("skillsToOpenAITools maps multiple skills", () => {
    const metas = [
      { name: "a", description: "A", params_schema: {} },
      { name: "b", description: "B", params_schema: { x: "string" } },
    ];
    const tools = skillsToOpenAITools(metas);
    expect(tools).toHaveLength(2);
    expect(tools[0].function.name).toBe("a");
    expect(tools[1].function.name).toBe("b");
    expect(tools[1].function.parameters.required).toEqual(["x"]);
  });

  it("skillsToClaudeTools maps multiple skills", () => {
    const metas = [
      { name: "a", description: "A", params_schema: {} },
      { name: "b", description: "B", params_schema: {} },
    ];
    const tools = skillsToClaudeTools(metas);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(["a", "b"]);
  });
});

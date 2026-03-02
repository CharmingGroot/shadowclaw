/**
 * 테스트용 MCP 서버 (HTTP, JSON-RPC 2.0).
 * MCP 등록·ReAct 에이전트 테스트용. tools/list, tools/call 지원.
 *
 * 실행: npm run test:mcp-server [port]  또는  npx tsx src/test-mcp-server.ts [port]
 * 기본 포트: 9999
 */
import { createServer, type Server } from "http";

const DEFAULT_PORT = 9999;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

type ToolImpl = (args: Record<string, unknown>) => Promise<string> | string;

const TOOLS: ToolDef[] = [
  {
    name: "echo",
    description: "Echo back the given message. Test tool.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Text to echo back" } },
      required: ["message"],
    },
  },
  {
    name: "add",
    description: "Add two numbers. Test tool.",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "multiply",
    description: "Multiply two numbers. Test tool.",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "get_time",
    description: "Return current server time in ISO string. Test tool.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "reverse_string",
    description: "Reverse a string. Test tool.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "String to reverse" } },
      required: ["text"],
    },
  },
  {
    name: "uppercase",
    description: "Convert text to uppercase. Test tool.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
];

const toolImpls: Record<string, ToolImpl> = {
  echo: (args) => String(args?.message ?? ""),
  add: (args) => {
    const a = Number(args?.a ?? 0);
    const b = Number(args?.b ?? 0);
    return String(a + b);
  },
  multiply: (args) => {
    const a = Number(args?.a ?? 0);
    const b = Number(args?.b ?? 0);
    return String(a * b);
  },
  get_time: () => new Date().toISOString(),
  reverse_string: (args) => String(args?.text ?? "").split("").reverse().join(""),
  uppercase: (args) => String(args?.text ?? "").toUpperCase(),
};

function toolsList(): { tools: Array<{ name: string; description?: string; inputSchema: unknown }> } {
  return {
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  };
}

async function toolsCall(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const fn = toolImpls[name];
  if (!fn) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
  try {
    const result = await Promise.resolve(fn(args ?? {}));
    return { content: [{ type: "text", text: result }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text", text: `Error: ${msg}` }] };
  }
}

async function handleJsonRpc(body: string): Promise<string> {
  let req: { jsonrpc?: string; id?: number; method?: string; params?: Record<string, unknown> };
  try {
    req = JSON.parse(body) as typeof req;
  } catch {
    return JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }

  const id = req.id ?? null;
  const method = req.method ?? "";
  const params = req.params ?? {};

  if (method === "initialize") {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "shadowclaw-test-mcp", version: "0.1.0" },
      },
    });
  }

  if (method === "tools/list") {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: toolsList(),
    });
  }

  if (method === "tools/call") {
    const name = params.name as string;
    const arguments_ = (params.arguments ?? params.args ?? {}) as Record<string, unknown>;
    const result = await toolsCall(name, arguments_);
    return JSON.stringify({ jsonrpc: "2.0", id, result });
  }

  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

export function createTestMcpServer(): Server {
  return createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "shadowclaw-test-mcp" }));
      return;
    }

    if (req.method !== "POST" || (req.url !== "/" && req.url !== "/mcp")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      res.setHeader("Content-Type", "application/json");
      try {
        const response = await handleJsonRpc(body);
        res.end(response);
      } catch {
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } }));
      }
    });
  });
}

export function startTestMcpServer(port: number = DEFAULT_PORT): Promise<Server> {
  const server = createTestMcpServer();
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const PORT_RETRY_MAX = 5;

function main(): void {
  const firstPort = Number(process.env.PORT ?? process.argv[2] ?? DEFAULT_PORT);

  function tryListen(port: number, attempt: number): void {
    const server = createTestMcpServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && attempt < PORT_RETRY_MAX) {
        tryListen(firstPort + attempt, attempt + 1);
      } else {
        console.error(err.message ?? String(err));
        process.exitCode = 1;
      }
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`Test MCP server: http://127.0.0.1:${port}`);
      if (port !== firstPort) console.log(`  (포트 ${firstPort} 사용 중이라 ${port} 사용)`);
      console.log("  GET  /health  — health check");
      console.log("  POST /        — JSON-RPC (tools/list, tools/call)");
    });
  }

  tryListen(firstPort, 1);
}

const isMain = process.argv[1]?.includes("test-mcp-server");
if (isMain) {
  main();
}

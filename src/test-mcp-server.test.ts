import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestMcpServer } from "./test-mcp-server.js";

describe("test-mcp-server", () => {
  let server: Awaited<ReturnType<typeof startTestMcpServer>>;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startTestMcpServer(0);
    const addr = server.address();
    const port = typeof addr === "object" && addr?.port ? addr.port : 9999;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server?.close();
  });

  it("GET /health returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("shadowclaw-test-mcp");
  });

  it("POST tools/list returns tool list", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.result?.tools).toBeDefined();
    const names = (data.result.tools as { name: string }[]).map((t) => t.name);
    expect(names).toContain("echo");
    expect(names).toContain("add");
    expect(names).toContain("multiply");
    expect(names).toContain("get_time");
    expect(names).toContain("reverse_string");
    expect(names).toContain("uppercase");
  });

  it("POST tools/call echo returns message", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "echo", arguments: { message: "hello" } },
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.result?.content).toHaveLength(1);
    expect(data.result.content[0].type).toBe("text");
    expect(data.result.content[0].text).toBe("hello");
  });

  it("POST tools/call add returns sum", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "add", arguments: { a: 10, b: 32 } },
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.result?.content[0].text).toBe("42");
  });

  it("POST tools/call multiply returns product", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "multiply", arguments: { a: 6, b: 7 } },
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.result?.content[0].text).toBe("42");
  });

  it("POST tools/call reverse_string and uppercase can be mixed", async () => {
    const rev = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "reverse_string", arguments: { text: "abc" } },
      }),
    });
    const revData = await rev.json();
    expect(revData.result?.content[0].text).toBe("cba");

    const up = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "uppercase", arguments: { text: "hello" } },
      }),
    });
    const upData = await up.json();
    expect(upData.result?.content[0].text).toBe("HELLO");
  });

  it("POST tools/call get_time returns ISO string", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "get_time", arguments: {} },
      }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    const text = data.result?.content[0].text;
    expect(text).toBeDefined();
    expect(() => new Date(text as string).toISOString()).not.toThrow();
  });
});

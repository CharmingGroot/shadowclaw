import { Router, type Request, type Response } from "express";
import { z } from "zod";
import * as mcpStore from "../mcpStore.js";

const router = Router();

/** HTTP MCP 서버에 JSON-RPC tools/list 요청 후 도구 목록 반환 */
async function fetchToolsFromMcpServer(url: string): Promise<{ name: string; description?: string }[]> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
  });
  if (!res.ok) throw new Error(`MCP server returned ${res.status}`);
  const data = (await res.json()) as { result?: { tools?: Array<{ name: string; description?: string }> }; error?: unknown };
  if (data.error) throw new Error(typeof data.error === "object" && data.error && "message" in data.error ? String((data.error as { message: string }).message) : "tools/list failed");
  const tools = data.result?.tools ?? [];
  return tools.map((t) => ({ name: t.name, description: t.description }));
}

const mcpServerBody = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  transport: z.enum(["stdio", "http"]).optional(),
  tools: z.array(z.object({ name: z.string(), description: z.string().optional() })).optional(),
});

router.get("/servers", (_req: Request, res: Response) => {
  res.json({ servers: mcpStore.listServers() });
});

router.post("/servers", (req: Request, res: Response) => {
  const parsed = mcpServerBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const id = mcpStore.addServer(parsed.data);
  const server = mcpStore.getServer(id);
  res.status(201).json(server);
});

router.get("/servers/:id", (req: Request, res: Response) => {
  const server = mcpStore.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  res.json(server);
});

router.get("/servers/:id/tools", async (req: Request, res: Response) => {
  const server = mcpStore.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const url = server.url?.trim();
  if (url) {
    try {
      const tools = await fetchToolsFromMcpServer(url);
      return res.json({ tools });
    } catch (e) {
      return res.json({ tools: server.tools ?? [], error: e instanceof Error ? e.message : "Failed to fetch tools" });
    }
  }
  res.json({ tools: mcpStore.getServerTools(req.params.id) });
});

router.delete("/servers/:id", (req: Request, res: Response) => {
  if (!mcpStore.deleteServer(req.params.id)) return res.status(404).json({ error: "Server not found" });
  res.status(204).send();
});

export default router;

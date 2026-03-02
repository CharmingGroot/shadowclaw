import { Router, type Request, type Response } from "express";
import { z } from "zod";
import * as mcpStore from "../mcpStore.js";

const router = Router();

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

router.get("/servers/:id/tools", (req: Request, res: Response) => {
  const tools = mcpStore.getServerTools(req.params.id);
  res.json({ tools });
});

router.delete("/servers/:id", (req: Request, res: Response) => {
  if (!mcpStore.deleteServer(req.params.id)) return res.status(404).json({ error: "Server not found" });
  res.status(204).send();
});

export default router;

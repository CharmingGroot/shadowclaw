import { Router, type Request, type Response } from "express";
import { z } from "zod";
import * as sessionStore from "./sessionStore.js";
import * as skillTools from "./tools/skill-tools.js";
import * as mcpStore from "./mcpStore.js";
import { complete, type ModelKind } from "./llm.js";
import { runReact } from "./react.js";
import "./skills/index.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "shadowclaw-api" });
});

router.get("/sessions", (_req: Request, res: Response) => {
  res.json({ sessions: sessionStore.listSessions() });
});

const newSessionBody = z.object({
  title: z.string().max(120).optional(),
});

router.post("/sessions", (req: Request, res: Response) => {
  const parsed = newSessionBody.safeParse(req.body ?? {});
  const title = parsed.success ? parsed.data?.title : undefined;
  const sessionId = sessionStore.createSession(title);
  res.status(201).json({ session_id: sessionId });
});

router.get("/sessions/:id", (req: Request, res: Response) => {
  const meta = sessionStore.getSessionMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: "Session not found" });
  const history = sessionStore.getHistory(req.params.id);
  res.json({ session_id: req.params.id, ...meta, messages: history });
});

router.get("/sessions/:id/messages", (req: Request, res: Response) => {
  const meta = sessionStore.getSessionMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: "Session not found" });
  const history = sessionStore.getHistory(req.params.id);
  res.json({ messages: history });
});

router.delete("/sessions/:id", (req: Request, res: Response) => {
  if (!sessionStore.deleteSession(req.params.id)) return res.status(404).json({ error: "Session not found" });
  res.status(204).send();
});

const patchSessionBody = z.object({
  title: z.string().max(120),
});

router.patch("/sessions/:id", (req: Request, res: Response) => {
  const parsed = patchSessionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "title required (max 120)" });
  if (!sessionStore.updateSessionTitle(req.params.id, parsed.data.title)) return res.status(404).json({ error: "Session not found" });
  res.json({ ok: true });
});

router.get("/skills", (req: Request, res: Response) => {
  const includeDisabled = req.query.include_disabled === "1";
  res.json({ skills: skillTools.listSkills({ includeDisabled }), hitl_skills: [] });
});

router.get("/skills/:name", (req: Request, res: Response) => {
  const { skill } = skillTools.getSkill({ name: req.params.name });
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  res.json(skill);
});

const patchSkillBody = z.object({
  description: z.string().optional(),
  require_hitl: z.boolean().optional(),
  enabled: z.boolean().optional(),
  content: z.string().optional(),
});

router.patch("/skills/:name", (req: Request, res: Response) => {
  const parsed = patchSkillBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const result = skillTools.updateSkillMeta({ name: req.params.name, ...parsed.data });
  if ("error" in result) return res.status(404).json({ error: result.error });
  res.json(result);
});

const chatBody = z.object({
  content: z.string().min(1),
  session_id: z.string().optional(),
  model: z.enum(["claude", "gpt"]).optional(),
  force_skill: z.string().optional(),
});

router.post("/chat", async (req: Request, res: Response) => {
  const parsed = chatBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "content is required" });
  const { content, session_id, model, force_skill } = parsed.data;
  let sessionId = session_id;
  if (sessionId && !sessionStore.getSessionMeta(sessionId)) sessionId = undefined;
  if (!sessionId) sessionId = sessionStore.createSession();
  const history = sessionStore.getHistory(sessionId);
  sessionStore.append(sessionId, { role: "user", content, timestamp: new Date().toISOString() });

  const llm = (prompt: string) => complete(prompt, (model as ModelKind) ?? "claude");
  const { content: reply, tool_calls } = await runReact(content, history, { llm, forceSkill: force_skill });

  sessionStore.append(sessionId, {
    role: "assistant",
    content: reply,
    timestamp: new Date().toISOString(),
    tool_calls,
  });
  res.json({ session_id: sessionId, content: reply, tool_calls });
});

router.get("/mcp/servers", (_req: Request, res: Response) => {
  res.json({ servers: mcpStore.listServers() });
});

const mcpServerBody = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  transport: z.enum(["stdio", "http"]).optional(),
  tools: z.array(z.object({ name: z.string(), description: z.string().optional() })).optional(),
});

router.post("/mcp/servers", (req: Request, res: Response) => {
  const parsed = mcpServerBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const id = mcpStore.addServer(parsed.data);
  const server = mcpStore.getServer(id);
  res.status(201).json(server);
});

router.get("/mcp/servers/:id", (req: Request, res: Response) => {
  const server = mcpStore.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  res.json(server);
});

router.get("/mcp/servers/:id/tools", (req: Request, res: Response) => {
  const tools = mcpStore.getServerTools(req.params.id);
  res.json({ tools });
});

router.delete("/mcp/servers/:id", (req: Request, res: Response) => {
  if (!mcpStore.deleteServer(req.params.id)) return res.status(404).json({ error: "Server not found" });
  res.status(204).send();
});

export default router;

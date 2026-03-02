import { Router, type Request, type Response } from "express";
import { z } from "zod";
import * as sessionStore from "../sessionStore.js";

const router = Router();

const newSessionBody = z.object({
  title: z.string().max(120).optional(),
});

const patchSessionBody = z.object({
  title: z.string().max(120),
});

router.get("/", (_req: Request, res: Response) => {
  res.json({ sessions: sessionStore.listSessions() });
});

router.post("/", (req: Request, res: Response) => {
  const parsed = newSessionBody.safeParse(req.body ?? {});
  const title = parsed.success ? parsed.data?.title : undefined;
  const sessionId = sessionStore.createSession(title);
  res.status(201).json({ session_id: sessionId });
});

router.get("/:id", (req: Request, res: Response) => {
  const meta = sessionStore.getSessionMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: "Session not found" });
  const history = sessionStore.getHistory(req.params.id);
  res.json({ session_id: req.params.id, ...meta, messages: history });
});

router.get("/:id/messages", (req: Request, res: Response) => {
  const meta = sessionStore.getSessionMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: "Session not found" });
  const history = sessionStore.getHistory(req.params.id);
  res.json({ messages: history });
});

router.delete("/:id", (req: Request, res: Response) => {
  if (!sessionStore.deleteSession(req.params.id)) return res.status(404).json({ error: "Session not found" });
  res.status(204).send();
});

router.patch("/:id", (req: Request, res: Response) => {
  const parsed = patchSessionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "title required (max 120)" });
  if (!sessionStore.updateSessionTitle(req.params.id, parsed.data.title)) return res.status(404).json({ error: "Session not found" });
  res.json({ ok: true });
});

export default router;

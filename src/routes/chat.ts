import { Router, type Request, type Response } from "express";
import { z } from "zod";
import * as sessionStore from "../sessionStore.js";
import { complete, type ModelKind } from "../llm/index.js";
import { runReact } from "../react.js";

const router = Router();

const chatBody = z.object({
  content: z.string().min(1),
  session_id: z.string().optional(),
  model: z.enum(["claude", "gpt"]).optional(),
  force_skill: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
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

export default router;

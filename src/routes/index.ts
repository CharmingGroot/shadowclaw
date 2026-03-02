import { Router, type Request, type Response } from "express";
import sessionsRouter from "./sessions.js";
import skillsRouter from "./skills.js";
import chatRouter from "./chat.js";
import mcpRouter from "./mcp.js";
import "../skills/index.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "shadowclaw-api" });
});

router.use("/sessions", sessionsRouter);
router.use("/skills", skillsRouter);
router.use("/chat", chatRouter);
router.use("/mcp", mcpRouter);

export default router;

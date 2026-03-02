import { Router, type Request, type Response } from "express";
import { z } from "zod";
import * as skillTools from "../tools/skill-tools.js";

const router = Router();

const postSkillBody = z.object({
  name: z.string().min(1).max(120),
  /** 마크다운 본문. 있으면 여기서 description·params_schema 파싱(단일 소스). */
  content: z.string().optional(),
  description: z.string().optional(),
  params_schema: z.record(z.string()).optional(),
});

const patchSkillBody = z.object({
  description: z.string().optional(),
  require_hitl: z.boolean().optional(),
  enabled: z.boolean().optional(),
  content: z.string().optional(),
});

router.get("/", (req: Request, res: Response) => {
  const includeDisabled = req.query.include_disabled === "1";
  const excludeBuiltin = req.query.exclude_builtin === "1";
  res.json({
    skills: skillTools.listSkills({ includeDisabled, excludeBuiltin }),
    hitl_skills: [],
  });
});

router.post("/", (req: Request, res: Response) => {
  const parsed = postSkillBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { name, content, description, params_schema } = parsed.data;
  const result = skillTools.createCustomSkill({
    name,
    content,
    description,
    params_schema: params_schema ?? undefined,
  });
  if ("error" in result) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

router.get("/:name", (req: Request, res: Response) => {
  const { skill } = skillTools.getSkill({ name: req.params.name });
  if (!skill) return res.status(404).json({ error: "Skill not found" });
  res.json(skill);
});

router.patch("/:name", (req: Request, res: Response) => {
  const parsed = patchSkillBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const result = skillTools.updateSkillMeta({ name: req.params.name, ...parsed.data });
  if ("error" in result) return res.status(404).json({ error: result.error });
  res.json(result);
});

router.delete("/:name", (req: Request, res: Response) => {
  const result = skillTools.deleteCustomSkill({ name: req.params.name });
  if ("error" in result) {
    if (result.error.startsWith("Cannot delete built-in")) return res.status(403).json({ error: result.error });
    return res.status(404).json({ error: result.error });
  }
  res.status(204).send();
});

export default router;

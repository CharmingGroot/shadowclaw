import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(routes);
app.use(express.static(path.join(__dirname, "..", "public")));

const port = Number(process.env.PORT) || 5052;
app.listen(port, () => {
  console.log(`ShadowClaw API: http://127.0.0.1:${port}`);
  console.log(`  UI:  http://127.0.0.1:${port}/`);
  console.log("  GET  /health          — health check");
  console.log("  GET  /sessions        — list sessions");
  console.log("  POST /sessions        — create session");
  console.log("  GET  /sessions/:id    — get session + history");
  console.log("  PATCH /sessions/:id   — update title");
  console.log("  DELETE /sessions/:id  — delete session");
  console.log("  GET  /skills          — list skills");
  console.log("  POST /chat            — send message (ReAct + LLM stub/API)");
  console.log("  GET  /mcp/servers     — list MCP servers");
  console.log("  POST /mcp/servers     — add MCP server");
  console.log("  GET  /mcp/servers/:id/tools — list server tools");
  console.log("  DELETE /mcp/servers/:id — remove server");
});

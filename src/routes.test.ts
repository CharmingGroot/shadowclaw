import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import routes from "./routes.js";

const app = express();
app.use(express.json());
app.use(routes);

describe("routes", () => {
  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("shadowclaw-api");
  });

  it("GET /skills returns array", async () => {
    const res = await request(app).get("/skills");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.skills)).toBe(true);
    expect(res.body.skills.some((s: { name: string }) => s.name === "list_skills_meta")).toBe(true);
  });

  it("POST /sessions and GET /sessions/:id", async () => {
    const create = await request(app).post("/sessions").send({ title: "테스트 세션" });
    expect(create.status).toBe(201);
    const sessionId = create.body.session_id;
    const get = await request(app).get(`/sessions/${sessionId}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe("테스트 세션");
  });

  it("POST /chat returns content and session_id", async () => {
    const create = await request(app).post("/sessions").send({});
    const sessionId = create.body.session_id;
    const chat = await request(app).post("/chat").send({ content: "hello", session_id: sessionId });
    expect(chat.status).toBe(200);
    expect(chat.body.session_id).toBe(sessionId);
    expect(typeof chat.body.content).toBe("string");
    expect(chat.body.content.length).toBeGreaterThan(0);
  });

  it("GET /mcp/servers returns array", async () => {
    const res = await request(app).get("/mcp/servers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.servers)).toBe(true);
  });

  it("POST /mcp/servers and DELETE", async () => {
    const post = await request(app).post("/mcp/servers").send({ name: "local", url: "http://127.0.0.1:9999" });
    expect(post.status).toBe(201);
    const id = post.body.id;
    const del = await request(app).delete(`/mcp/servers/${id}`);
    expect(del.status).toBe(204);
  });
});

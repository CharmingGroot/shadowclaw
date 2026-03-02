import { describe, it, expect, beforeAll } from "vitest";
import * as sessionStore from "./sessionStore.js";

describe("sessionStore", () => {
  beforeAll(() => {
    sessionStore.initSessionDb(":memory:");
  });

  it("createSession returns id", () => {
    const id = sessionStore.createSession();
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
  });

  it("append and getHistory return Message[] (user/assistant/tool)", () => {
    const id = sessionStore.createSession("테스트");
    sessionStore.append(id, { role: "user", content: "안녕" });
    const history = sessionStore.getHistory(id);
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("안녕");
  });

  it("appendMessages stores assistant and tool messages in order", () => {
    const id = sessionStore.createSession();
    sessionStore.append(id, { role: "user", content: "run" });
    sessionStore.appendMessages(id, [
      { role: "assistant", content: "{}" },
      { role: "tool", content: "ok" },
      { role: "assistant", content: "done" },
    ]);
    const history = sessionStore.getHistory(id);
    expect(history).toHaveLength(4);
    expect(history[1].role).toBe("assistant");
    expect(history[2].role).toBe("tool");
    expect(history[2].content).toBe("ok");
    expect(history[3].role).toBe("assistant");
  });

  it("listSessions includes created session", () => {
    const id = sessionStore.createSession("제목");
    const list = sessionStore.listSessions();
    expect(list.some((s) => s.id === id)).toBe(true);
    expect(list.find((s) => s.id === id)?.title).toBe("제목");
  });

  it("deleteSession removes session", () => {
    const id = sessionStore.createSession();
    expect(sessionStore.deleteSession(id)).toBe(true);
    expect(sessionStore.getSessionMeta(id)).toBeUndefined();
  });

  it("updateSessionTitle", () => {
    const id = sessionStore.createSession();
    sessionStore.updateSessionTitle(id, "새 제목");
    expect(sessionStore.getSessionMeta(id)?.title).toBe("새 제목");
  });
});

import { describe, it, expect } from "vitest";
import * as sessionStore from "./sessionStore.js";

describe("sessionStore", () => {
  it("createSession returns id", () => {
    const id = sessionStore.createSession();
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
  });

  it("append and getHistory", () => {
    const id = sessionStore.createSession("테스트");
    sessionStore.append(id, { role: "user", content: "안녕", timestamp: new Date().toISOString() });
    const history = sessionStore.getHistory(id);
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe("안녕");
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

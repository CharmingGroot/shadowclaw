/**
 * 세션 저장소 — 대화 이력·세션 메타 (in-memory)
 */
import { v4 as uuidv4 } from "uuid";
import type { Turn } from "./types.js";

const MAX_TURNS = 50;
const MAX_TITLE_LEN = 120;

interface SessionEntry {
  turns: Turn[];
  title?: string;
  updated_at: number;
}

const store = new Map<string, SessionEntry>();

function now(): number {
  return Date.now();
}

export function createSession(title?: string): string {
  const sessionId = uuidv4();
  store.set(sessionId, {
    turns: [],
    title: title?.trim().slice(0, MAX_TITLE_LEN),
    updated_at: now(),
  });
  return sessionId;
}

export function getHistory(sessionId: string): Turn[] {
  const entry = store.get(sessionId);
  if (!entry) return [];
  return entry.turns.slice(-MAX_TURNS);
}

export function append(sessionId: string, turn: Turn): void {
  let entry = store.get(sessionId);
  if (!entry) {
    entry = { turns: [], updated_at: now() };
    store.set(sessionId, entry);
  }
  if (turn.role === "user" && !entry.title) {
    entry.title = turn.content.trim().slice(0, MAX_TITLE_LEN) || "새 대화";
  }
  entry.turns.push(turn);
  entry.updated_at = now();
  if (entry.turns.length > MAX_TURNS) {
    entry.turns = entry.turns.slice(-MAX_TURNS);
  }
}

export function listSessions(): { id: string; title: string; updated_at: number }[] {
  return Array.from(store.entries())
    .map(([id, e]) => ({
      id,
      title: e.title ?? "새 대화",
      updated_at: e.updated_at,
    }))
    .sort((a, b) => b.updated_at - a.updated_at);
}

export function deleteSession(sessionId: string): boolean {
  return store.delete(sessionId);
}

export function updateSessionTitle(sessionId: string, title: string): boolean {
  const entry = store.get(sessionId);
  if (!entry) return false;
  entry.title = title.trim().slice(0, MAX_TITLE_LEN) || "새 대화";
  entry.updated_at = now();
  return true;
}

export function getSessionMeta(sessionId: string): { title: string; updated_at: number } | undefined {
  const entry = store.get(sessionId);
  if (!entry) return undefined;
  return { title: entry.title ?? "새 대화", updated_at: entry.updated_at };
}

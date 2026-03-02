/**
 * SQLite-backed session store (OpenClaw-style persistence).
 * Same interface as the in-memory sessionStore for drop-in replacement.
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import type { Turn } from "../types.js";

const MAX_TURNS = 50;
const MAX_TITLE_LEN = 120;

const defaultDbPath = (): string => {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "sessions.db");
};

let db: Database.Database | null = null;

function getDb(dbPath?: string): Database.Database {
  if (db) return db;
  const p = dbPath ?? defaultDbPath();
  db = new Database(p);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT,
      tool_calls_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  `);
  return db;
}

/** For tests: use in-memory DB. Call with dbPath before any other sessionStore usage. */
export function initSessionDb(dbPath: string): void {
  if (db) {
    db.close();
    db = null;
  }
  getDb(dbPath);
}

function now(): number {
  return Date.now();
}

export function createSession(title?: string, dbPath?: string): string {
  const sessionId = uuidv4();
  const database = getDb(dbPath);
  const t = now();
  database
    .prepare("INSERT INTO sessions (id, title, updated_at) VALUES (?, ?, ?)")
    .run(sessionId, title?.trim().slice(0, MAX_TITLE_LEN) ?? null, t);
  return sessionId;
}

export function getHistory(sessionId: string, dbPath?: string): Turn[] {
  const database = getDb(dbPath);
  const rows = database
    .prepare(
      "SELECT role, content, timestamp, tool_calls_json FROM messages WHERE session_id = ? ORDER BY id"
    )
    .all(sessionId) as { role: string; content: string; timestamp: string | null; tool_calls_json: string | null }[];
  const turns: Turn[] = rows.map((r) => {
    const turn: Turn = {
      role: r.role as "user" | "assistant",
      content: r.content,
      timestamp: r.timestamp ?? new Date().toISOString(),
    };
    if (r.tool_calls_json) {
      try {
        turn.tool_calls = JSON.parse(r.tool_calls_json) as Turn["tool_calls"];
      } catch {
        /* ignore */
      }
    }
    return turn;
  });
  return turns.slice(-MAX_TURNS);
}

export function append(sessionId: string, turn: Turn, dbPath?: string): void {
  const database = getDb(dbPath);
  const entry = database.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
  if (!entry) {
    database
      .prepare("INSERT INTO sessions (id, title, updated_at) VALUES (?, ?, ?)")
      .run(sessionId, null, now());
  }
  if (turn.role === "user") {
    const meta = database.prepare("SELECT title FROM sessions WHERE id = ?").get(sessionId) as { title: string | null } | undefined;
    if (meta && !meta.title) {
      const title = turn.content.trim().slice(0, MAX_TITLE_LEN) || "새 대화";
      database.prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?").run(title, now(), sessionId);
    }
  }
  database
    .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
    .run(now(), sessionId);
  database
    .prepare(
      "INSERT INTO messages (session_id, role, content, timestamp, tool_calls_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      sessionId,
      turn.role,
      turn.content,
      turn.timestamp,
      turn.tool_calls ? JSON.stringify(turn.tool_calls) : null,
      now()
    );
  const count = database.prepare("SELECT COUNT(*) as c FROM messages WHERE session_id = ?").get(sessionId) as { c: number };
  if (count.c > MAX_TURNS) {
    const toDelete = count.c - MAX_TURNS;
    const ids = database
      .prepare("SELECT id FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT ?")
      .all(sessionId, toDelete) as { id: number }[];
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      database.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...ids.map((r) => r.id));
    }
  }
}

export function listSessions(dbPath?: string): { id: string; title: string; updated_at: number }[] {
  const database = getDb(dbPath);
  const rows = database
    .prepare("SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC")
    .all() as { id: string; title: string | null; updated_at: number }[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? "새 대화",
    updated_at: r.updated_at,
  }));
}

export function deleteSession(sessionId: string, dbPath?: string): boolean {
  const database = getDb(dbPath);
  const r = database.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  return r.changes > 0;
}

export function updateSessionTitle(sessionId: string, title: string, dbPath?: string): boolean {
  const database = getDb(dbPath);
  const r = database
    .prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?")
    .run(title.trim().slice(0, MAX_TITLE_LEN) || "새 대화", now(), sessionId);
  return r.changes > 0;
}

export function getSessionMeta(sessionId: string, dbPath?: string): { title: string; updated_at: number } | undefined {
  const database = getDb(dbPath);
  const row = database.prepare("SELECT title, updated_at FROM sessions WHERE id = ?").get(sessionId) as
    | { title: string | null; updated_at: number }
    | undefined;
  if (!row) return undefined;
  return { title: row.title ?? "새 대화", updated_at: row.updated_at };
}

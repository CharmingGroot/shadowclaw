/**
 * 세션 저장소 — SQLite 기반 영속화 (OpenClaw 스타일).
 * API는 기존과 동일; 구현만 src/db/sessionStoreDb.ts 사용.
 */
export {
  createSession,
  getHistory,
  append,
  appendMessages,
  listSessions,
  deleteSession,
  updateSessionTitle,
  getSessionMeta,
  initSessionDb,
} from "./db/sessionStoreDb.js";

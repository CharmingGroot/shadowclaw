# OpenClaw 스타일 컨텍스트 엔지니어링 도입 기획

ShadowClaw에 OpenClaw의 컨텍스트 엔지니어링 아키텍처를 적용한다.  
시스템 프롬프트와 대화 메시지 분리, 메시지 배열 형식, 세션 영속화(SQLite)를 도입한다.

---

## 1. 목표·범위

### 1.1 목표

- **시스템 vs 메시지 분리**: 시스템 프롬프트(역할·형식·스킬 요약)와 대화(히스토리 + 현재 턴)를 분리하여 LLM API에 전달.
- **메시지 배열**: 히스토리를 `role: user | assistant`, `content` 형태의 배열로 유지하고 API `messages`에 그대로 전달.
- **세션 영속화**: 메모리 대신 SQLite에 세션·메시지 저장하여 재시작 후에도 복구 가능.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| 시스템 프롬프트 구조화(섹션별) | 네이티브 tool calling (별도 plan-native-tool-calling.md) |
| LLM 호출 시 system + messages 전달 | 스트리밍·이벤트 |
| SQLite 기반 세션·메시지 저장 | 트랜스크립트 위생(thinking 제거 등)은 후순위 |

---

## 2. OpenClaw 방식 요약

- **시스템 프롬프트**: Identity → Tooling(도구 이름·한 줄 요약) → Format → Safety 등 섹션 구성. 도구 전체 스키마는 API `tools`로 전달(현재는 ReAct이므로 스킬 요약만 시스템에).
- **대화**: `messages[]` = 이전 턴들(user/assistant) + 현재 턴 user 메시지. 히스토리 마커·현재 메시지 구분 가능.
- **도구 결과**: 네이티브 시에는 role: tool; ReAct 유지 시에는 현재 턴 user content에 "Observations" 블록으로 포함.

---

## 3. 설계

### 3.1 시스템 프롬프트 구조

1. **Identity**: "You are a helpful assistant with access to skills (tools)."
2. **Output format**: "Respond ONLY with a single JSON object." + Format 1(call) / Format 2(answer) 예시.
3. **Tooling**: "Available skills (name and one-line description):" + 스킬 이름·한 줄 설명만 (params_schema는 생략 또는 요약).
4. **Observation rule**: "When you give a final answer, you MUST apply any instructions from Observations (tone, style, manner) to your content."
5. **Force skill** (선택): "User requested to use skill \"...\". Prefer calling it."

### 3.2 메시지 배열

- **히스토리**: DB에서 조회한 `Turn[]` → `{ role: "user"|"assistant", content: string }[]`. assistant 턴은 `content`에 본문만; tool_calls는 필요 시 content 끝에 요약 문자열로 붙이거나 생략.
- **현재 턴**: ReAct 루프 내 한 스텝 = "User message" + "Observations" 블록을 합친 하나의 user 메시지.
- **API 전달**: `messages = [ ...historyMessages, { role: "user", content: currentTurnContent } ]`.

### 3.3 세션 저장 (SQLite)

- **테이블**
  - `sessions`: `id` (TEXT PK), `title` (TEXT), `updated_at` (INTEGER).
  - `messages`: `id` (INTEGER PK), `session_id` (TEXT FK), `role` (TEXT), `content` (TEXT), `timestamp` (TEXT), `tool_calls_json` (TEXT), `created_at` (INTEGER).
- **인터페이스**: 기존 `sessionStore`와 동일 (`createSession`, `getHistory`, `append`, `listSessions`, `deleteSession`, `updateSessionTitle`, `getSessionMeta`). 내부 구현만 SQLite로 교체.

### 3.4 LLM 레이어

- **신규**: `completeWithContext({ systemPrompt, messages }, model): Promise<string>`  
  - Claude: `system` 필드 + `messages` 배열.
  - OpenAI: `messages = [ { role: "system", content: systemPrompt }, ...messages ]`.
- **기존**: `complete(prompt, model)` 유지(스텁·레거시용). 채팅 경로는 `completeWithContext` 사용.

---

## 4. 적용 단계

1. **의존성**: `better-sqlite3` 추가.
2. **DB 모듈**: `src/db/sessionStore.ts` (또는 `src/sessionStoreDb.ts`) 구현, 기존 `sessionStore`를 이 구현을 쓰도록 교체.
3. **프롬프트**: `buildSystemPrompt(skillsDesc, forceSkill?)`, `buildCurrentTurnContent(userMessage, observations)` 분리. `buildAgentReactPrompt`는 현재 턴용만 사용(히스토리 제거).
4. **LLM**: `completeWithContext` 추가, Claude/OpenAI/stub 각각 수정.
5. **에이전트**: `runReact`에서 히스토리 → messages 변환, systemPrompt + messages로 `completeWithContext` 호출.
6. **테스트**: 세션 CRUD·히스토리 로드, 프롬프트 분리·메시지 형식 검증, 통합 테스트.

---

## 5. 구현 완료 (적용 내역)

- **세션 저장소**: `src/db/sessionStoreDb.ts` — SQLite(sessions + messages), `src/sessionStore.ts`가 재export. 테스트 시 `initSessionDb(":memory:")` 사용.
- **프롬프트**: `buildSystemPrompt`, `buildCurrentTurnContent`, `turnsToMessages` 추가. `buildAgentReactPrompt`는 레거시/테스트용 유지.
- **LLM**: `completeWithContext({ systemPrompt, messages }, model)` — Claude는 `system` 필드, OpenAI는 `role: "system"` 첫 메시지.
- **에이전트**: `runReact`가 `model` 옵션으로 `completeWithContext` 호출, 히스토리는 `turnsToMessages(history)` 후 messages에 포함.
- **채팅 라우트**: `runReact(content, history, { model, forceSkill })` 로 전달.

---

## 6. 참조

- `plan-native-tool-calling.md`: 네이티브 tool calling 시 컨텍스트 형식 확장(role: tool, tools 파라미터).
- OpenClaw: `src/config/sessions/`, `src/infra/outbound/session-context.ts` 등.

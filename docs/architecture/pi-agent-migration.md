# Pi(pi-ai, pi-agent) 도입 기획서

OpenClaw처럼 **에이전트 루프를 Pi SDK에 전격 위임**하는 방식으로 전환한다.  
ReAct(JSON 파싱) 방식을 제거하고, pi-ai + pi-coding-agent 기반 네이티브 tool calling으로 통일한다.

---

## 1. 목표·범위

### 1.1 목표

- **Pi 에이전트 전격 위임**: 도구 호출 루프·세션 형식·재호출 판단을 Pi의 `createAgentSession` + `session.prompt()`에 맡긴다.
- **ReAct 제거**: `runReact`, `extractJson`, `ACTION_CALL`/`ACTION_ANSWER` 기반 프롬프트/파싱 로직 제거.
- **동일 UX**: 채팅 API(`POST /chat`) 요청/응답 스펙은 유지하고, 내부만 Pi 기반으로 교체.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| pi-agent-core, pi-ai, pi-coding-agent 패키지 추가 | pi-tui (TUI 불필요) |
| 스킬 레지스트리 → Pi AgentTool 형식 변환 | MCP 서버 도구는 1차 제외(이후 확장) |
| streamFn 어댑터: 기존 Claude/OpenAI 키로 Pi context 호출 | 별도 OAuth/멀티 프로파일 |
| 세션: Pi SessionManager(파일) 또는 기존 SQLite와 연동 | 세션 목록/메타는 기존 유지 가능 |

---

## 2. OpenClaw 방식 정리

- **createAgentSession({ cwd, agentDir, authStorage, modelRegistry, model, thinkingLevel, tools, customTools, sessionManager, settingsManager, resourceLoader })**  
  → 세션 생성 후 **applySystemPromptOverrideToSession(session, systemPrompt)** 로 시스템 프롬프트 주입.
- **session.prompt(userMessage)** 한 번 호출 시, Pi 내부에서:
  - streamFn(model, context, options) 호출
  - 응답에 tool_calls 있으면 도구 실행 → 결과를 메시지에 추가 → streamFn 재호출
  - tool_calls 없으면 종료
- **SessionManager.open(sessionFile)**: 세션 파일(JSONL) 기반 영속화.
- **streamSimple**(pi-ai): 기본 streamFn. Model + Context(메시지·도구)를 받아 API 호출 후 스트림 반환.

---

## 3. ShadowClaw 적용 전략

### 3.1 제약

- createAgentSession은 **authStorage, modelRegistry, settingsManager, resourceLoader** 등 OpenClaw 전용 인프라에 의존한다.
- Pi 패키지가 이들 인터페이스를 어떻게 요구하는지에 따라 **최소 스텁**을 두거나, **Pi 스타일만 따르는 자체 러너**를 쓸 수 있다.

### 3.2 두 가지 경로

| 경로 | 내용 | 선택 기준 |
|------|------|------------|
| **A) 완전 Pi** | createAgentSession + SessionManager 사용. authStorage/modelRegistry/settingsManager/resourceLoader를 최소 구현 또는 스텁. | Pi 패키지 타입이 허용하는 최소 구현이 가능할 때 |
| **B) Pi 스타일 러너** | pi-ai만 사용. completeSimple/streamSimple(model, context, options)로 1회 호출하고, tool_calls 있으면 직접 도구 실행 후 context 갱신해 재호출. 세션은 기존 SQLite + Pi 메시지 형식으로 변환. | createAgentSession 의존이 과도할 때 |

**1차 구현**: 경로 B로 진행. pi-ai로 네이티브 tool calling 루프를 구현하고, 메시지 형식은 Pi(AgentMessage)와 호환되게 맞춘다.  
이후 pi-coding-agent의 SessionManager·createAgentSession을 쓰고 싶으면, 별도 단계에서 스텁을 넣고 경로 A로 옮길 수 있다.

---

## 4. 구현 단계 (경로 B 기준)

### 4.1 패키지 추가

- `@mariozechner/pi-agent-core`: AgentTool, AgentToolResult, AgentMessage 등 타입.
- `@mariozechner/pi-ai`: streamSimple 또는 completeSimple, Model, Context 타입.
- (선택) `@mariozechner/pi-coding-agent`: SessionManager, createAgentSession — 경로 A로 갈 때 사용.

버전: OpenClaw와 동일하게 **0.55.1** (또는 현재 OpenClaw package.json 기준).

### 4.2 스킬 → Pi 도구 형식

- 현재: `registry.listSkills()` → `{ name, description, params_schema }`.
- Pi: `AgentTool<TParams, TResult>` 형태. `name`, `description`, `parameters`(JSON Schema), `execute(params) => Promise<AgentToolResult>`.
- **할 일**: `src/tools/skill-to-pi-tools.ts` (또는 기존 skill-tools 확장)에서 `listSkills()` 결과를 Pi AgentTool[]로 변환하고, execute 시 `registry.run(name, params)` 호출.

### 4.3 LLM 레이어: tools 지원

- **현재**: `completeWithContext({ systemPrompt, messages })` → 텍스트만 반환.
- **추가**: `completeWithTools({ systemPrompt, messages, tools }, model)`  
  - Claude: Messages API에 `tools` + `tool_use` 블록 처리.  
  - OpenAI: `tools` + `tool_calls` / `role: "tool"` 처리.  
  - 반환: `{ content?: string, tool_calls?: { id, name, arguments }[] }` (및 필요 시 usage 등).
- pi-ai의 completeSimple은 이미 tools를 받고 tool_calls를 반환할 수 있으므로, **streamFn 어댑터**에서는 pi-ai를 직접 쓰거나, 우리가 만든 completeWithTools 결과를 Pi Context 응답 형식으로 맞춘다.

### 4.4 Pi 스타일 러너 (자체 루프)

- **진입점**: `runPiStyle(sessionId, userMessage, options)` (새 파일 `src/pi-runner.ts` 또는 `src/agent-pi.ts`).
- **흐름**:
  1. 세션 히스토리 로드: `sessionStore.getHistory(sessionId)` → Pi 형식 메시지 배열로 변환.
  2. 사용자 메시지 추가.
  3. 시스템 프롬프트: 기존 `buildSystemPrompt()` 유지 (도구 이름·요약, Skills, Safety 등).
  4. 루프:
     - `completeWithTools(systemPrompt, messages, tools, model)` 호출 (또는 pi-ai completeSimple에 우리 context 주입).
     - 응답에 `tool_calls` 없음 → 최종 답변 반환, 메시지 저장 후 종료.
     - `tool_calls` 있음 → 각 도구 실행(registry.run), 결과를 메시지에 추가, messages 갱신 후 다시 호출 (최대 스텝 제한 유지).
  5. 반환: `{ content, tool_calls, messages }` — 기존 runReact와 동일한 형태로 채팅 라우트에 전달.
- **메시지 형식**: Pi/OpenClaw와 동일하게 `role: "user" | "assistant" | "tool"`, assistant 시 `tool_calls` 포함 가능. SQLite에는 이미 role/content 저장 중이므로, tool_calls는 JSON 문자열로 저장하거나 별도 컬럼 유지.

### 4.5 채팅 라우트 전환

- `POST /chat`: `runReact` 대신 `runPiStyle`(또는 Pi 세션 기반 러너) 호출.
- `sessionStore.append`, `appendMessages`는 그대로 사용. 단, Pi 형식 메시지로 append하도록 변환 레이어만 통일.

### 4.6 ReAct 제거

- `src/react.ts`: runReact 제거 또는 deprecated. ReAct 전용 상수/유틸(`extractJson`, `buildUserMessageContent`의 ReAct용 부분)은 프롬프트에서 제거.
- `src/prompts/agent-react.ts`: ReAct용 Format 예시(ACTION_CALL/ACTION_ANSWER) 제거. 시스템 프롬프트는 Identity, Safety, Skills, Workspace 등 **도구 이름·요약만** 남기고, 상세 스키마는 API `tools` 파라미터로만 전달.

---

## 5. 파일·모듈 구성 (예상)

| 파일 | 역할 |
|------|------|
| `src/llm/skill-to-tool-schema.ts` | 스킬 메타 → OpenAI/Claude API용 tools 배열 (기존 plan-native-tool-calling.md와 동일) |
| `src/tools/skill-to-pi-tools.ts` | 스킬 → Pi AgentTool[] 변환, execute 시 registry.run 연결 |
| `src/llm/index.ts` | completeWithTools 추가, 프로바이더별 분기 |
| `src/llm/claude.ts` | tools + tool_use 처리 |
| `src/llm/openai.ts` | tools + tool_calls 처리 |
| `src/agent-pi.ts` | runPiStyle: 시스템 프롬프트 + messages + tools 루프, completeWithTools 호출 |
| `src/prompts/agent-react.ts` | ReAct 포맷 제거, 시스템 프롬프트만 (도구 요약·Skills 규칙 등) |
| `src/routes/chat.ts` | runReact → runPiStyle 전환 |
| (선택) `src/react.ts` | deprecated 또는 삭제 |

---

## 6. 테스트

- 스킬 → Pi 도구 변환 단위 테스트.
- completeWithTools (스텁 또는 실제 API) 호출 시 tool_calls 반환 확인.
- runPiStyle: 1턴(도구 없음), 2턴(도구 1회 호출 후 답변) 시나리오.
- 기존 채팅 API 통합 테스트: session_id, content, model 파라미터로 POST 후 응답 형식 유지 확인.

---

## 7. 리스크·참고

- **Pi 버전**: 0.55.1 기준. pi-ai의 Context/Model 타입이 버전마다 다를 수 있음.
- **세션 호환**: 기존 SQLite에 저장된 메시지는 role/content만 있어도 동작. tool_calls가 있으면 JSON으로 보관하는 방식으로 확장 가능.
- **경로 A로의 이전**: 나중에 createAgentSession + SessionManager를 쓰려면, 세션 파일 경로를 `data/sessions/<id>.jsonl`로 두고, SessionManager.open으로 열어서 prompt 호출하는 식으로 라우트만 바꾸면 된다. 이때 authStorage 등은 최소 스텁으로 제공.

---

## 8. 요약

- **ReAct 제거**, **pi-ai 기반 네이티브 tool calling**으로 전환.
- 1차는 **Pi 스타일 자체 러너**(pi-ai + completeWithTools)로 구현하고, 채팅 라우트는 동일 응답 스펙 유지.
- 필요 시 pi-coding-agent의 SessionManager/createAgentSession 도입(경로 A)은 스텁 구현 후 2단계로 진행.

---

## 9. 구현 완료 사항 (1차)

- **경로 A(createAgentSession + SessionManager)**: 보류. pi-coding-agent 의존·authStorage/modelRegistry 등 스텁 구현 부담이 커서, 현재는 경로 B(자체 러너)만 유지.
- 패키지: `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai` 추가.
- `src/llm/skill-to-tool-schema.ts`: 스킬 메타 → OpenAI/Claude tools 배열 변환.
- `src/llm/claude.ts`, `openai.ts`: `callClaudeWithTools`, `callOpenAIWithTools` 추가 (tools + tool_calls 처리).
- `src/llm/index.ts`: `completeWithTools`, `MessageWithTools`, `ToolCallSpec` 추가.
- `src/agent-pi.ts`: `runPiStyle` — 네이티브 tool calling 루프, 시스템 프롬프트에 `useNativeTools: true`.
- `src/routes/chat.ts`: `runReact` → `runPiStyle` 전환.
- `src/prompts/agent-react.ts`: `useNativeTools` 옵션 추가 시 ReAct JSON 형식 문구 생략.
- `src/types.ts`, `src/db/sessionStoreDb.ts`: `tool_call_id`, `tool_calls_json` 지원 (assistant/tool 메시지).
- `src/react.ts` 제거 (채팅은 runPiStyle만 사용).

---

## 10. 남은 작업 (TODO)

→ [docs/TODO.md](../TODO.md) 참고.

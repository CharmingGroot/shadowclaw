# OpenClaw 방식 네이티브 Tool Calling 도입 기획

LLM 호출을 **프롬프트 기반 ReAct(JSON 파싱)** 에서 **API 네이티브 tool/function calling**으로 전환하는 기획이다.  
도입 전 모듈화 가능성과 단계별 적용 방안을 정리한다.

---

## 1. 목표·범위

### 1.1 목표

- **OpenClaw와 동일한 방식**: 채팅 API 요청 시 `messages` + `tools`(도구 정의)를 넘기고, 응답에서 **구조화된 tool_calls**를 받아 실행한 뒤, 결과를 메시지에 넣고 재호출하는 multi-turn 흐름.
- **효과**: JSON 파싱 실패·형식 오류 감소, 모델이 도구 스키마를 직접 인지해 호출 정확도 향상, OpenAI/Anthropic 권장 방식과 정렬.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| 채팅 1회 전송 시 에이전트 루프(도구 호출·재호출) | MCP 서버 도구는 1차 제외(이후 확장) |
| 내장 스킬 + 사용자 스킬 → API tool 스키마 변환 | 스킬 등록·편집·삭제 UI/API 유지 |
| Claude / OpenAI 각각의 tool 형식 지원 | 스트리밍·이벤트는 후순위 |

---

## 2. 현재 vs 변경 후

### 2.1 현재 (ReAct 프롬프트 기반)

```
[요청 1회]
  → 프롬프트: "JSON으로만 답하라. action: call | answer, skill, args"
  → LLM: 일반 채팅 API (messages에 시스템+유저만)
  → 응답: 텍스트 "{ \"action\": \"call\", \"skill\": \"read_file\", \"args\": {...} }"
  → extractJson() 파싱 → executeTool() → observation 추가
  → 같은 방식으로 반복 (최대 N스텝)
  → action: answer 이면 종료
```

- **LLM 시그니처**: `complete(prompt: string, model): Promise<string>`
- **도구 정보**: 프롬프트 문자열에 스킬 목록·params_schema를 박아 넣음.
- **한계**: JSON 이스케이프·누락 시 파싱 실패, 모델이 형식을 틀리기 쉬움.

### 2.2 변경 후 (네이티브 tool calling)

```
[요청 1회 = 1턴이 아닌, tool_calls 나올 때까지 반복]
  → messages: [ { role: "user", content: "..." }, (이전 턴 assistant + tool results) ]
  → tools: [ { type: "function", function: { name, description, parameters } }, ... ]
  → LLM: 채팅 API에 tools 파라미터 포함 (OpenAI: tools, Claude: tools)
  → 응답: content + tool_calls[] (구조화된 객체)
  → tool_calls 각각 실행 → tool result를 messages에 추가 (role: "tool" / tool_use 블록)
  → 동일 messages + tools로 재호출
  → tool_calls 없으면 최종 답변으로 종료
```

- **LLM 시그니처**:  
  `completeWithTools(messages, tools, model): Promise<{ content?: string; tool_calls: { id, name, arguments }[] }>`
- **도구 정보**: API 스펙의 `tools` 배열로 전달. 스킬 메타 → OpenAI/Claude 형식 변환 레이어 필요.

---

## 3. OpenClaw vs ShadowClaw 컨텍스트 엔지니어링 비교

### 3.1 시스템 프롬프트·구조

| 항목 | OpenClaw | ShadowClaw |
|------|----------|-------------|
| **구성** | **역할 분리**: 시스템 프롬프트와 대화 메시지를 분리. `session.agent.setSystemPrompt(systemPrompt)`로 시스템 설정, 대화는 `messages[]`로 전달. | **단일 플랫 프롬프트**: 시스템 지시 + 스킬 목록 + 유저 메시지 + 히스토리 + observations를 한 문자열로 합쳐서 매 턴마다 전송. |
| **시스템 내용** | 다단락 구조: Identity → Tooling(도구 목록·호출 스타일) → Safety → Skills(Mandatory, SKILL.md 참조) → Memory → Workspace → Sandbox 등. `promptMode`: full / minimal / none. | 짧은 고정 문구: "Respond ONLY with a single JSON object" + Format 예시 2종 + "Available skills:" + 스킬 텍스트. |
| **도구 노출** | 시스템에는 **도구 이름 + 한 줄 요약**만. "Tool names are case-sensitive. Call tools exactly as listed." + `toolLines`. 실제 스키마는 API `tools` 파라미터로 전달(네이티브). | 스킬 **전체**를 프롬프트에 문자열로: `name`, `description`, `params_schema` JSON. 도구는 API에 안 넘김. |

### 3.2 히스토리·대화 컨텍스트

| 항목 | OpenClaw | ShadowClaw |
|------|----------|-------------|
| **형식** | **메시지 배열** 유지: `role: user | assistant | tool`, API가 그대로 받음. OpenResponses 진입 시에는 `buildAgentMessageFromConversationEntries`로 ItemParam[] → **한 개 메시지 문자열**로 변환할 수 있음(플랫 입력용). | 매 스텝 **단일 문자열**: "Recent conversation:" + `history.slice(-6)` 각각 `role: content.slice(0,300)`. 구분자만 있고 마커 없음. |
| **마커** | `buildHistoryContext`: `[Chat messages since your last reply - for context]` + 히스토리 텍스트 + `CURRENT_MESSAGE_MARKER` + 현재 메시지. | 없음. |
| **도구 결과** | 메시지 배열에 **role: tool** 또는 Claude `tool_use` 블록으로 포함. 다음 호출 시 그대로 재전달. | "Observations (last tool results):" + `observations.slice(-3)` 각 1200자. 텍스트로만 주입. |

### 3.3 도구 결과·트랜스크립트

| 항목 | OpenClaw | ShadowClaw |
|------|----------|-------------|
| **도구 결과 반영** | API 메시지 스펙에 맞게 **구조화**: `function_call` ↔ `function_call_output` 쌍, `tool_use` ↔ tool result. | 매 스텝 **observation 문자열 배열**로 누적 후, 다음 프롬프트에 "Observations" 블록으로만 넣음. |
| **트랜스크립트 정리** | `sanitizeSessionHistory`, `dropThinkingBlocks`, `sanitizeToolCallIds`, `repairToolUseResultPairing` 등 **프로바이더별 정책**으로 role 순서·tool id·thinking 블록 정리 후 전송. | 없음. 매 요청이 독립된 단일 프롬프트. |

### 3.4 요약

- **OpenClaw**: 시스템 프롬프트는 **섹션별 구조화** + 도구는 **이름/요약만** 시스템에, **전체 스키마는 API tools**. 대화는 **messages[]** 유지, 도구 결과는 **role/tool_use**로 반영. 트랜스크립트 **위생 처리** 있음.
- **ShadowClaw**: **한 덩어리 프롬프트**에 시스템·스킬 전체·유저·히스토리·observations 포함. 도구는 **텍스트로만** 노출, API tools 없음. 히스토리/observations는 **문자열 슬라이스**로만 제한.

네이티브 tool calling 도입 시, ShadowClaw도 **시스템 vs 메시지 분리**·**messages[] + tools**·**도구 결과를 메시지로 추가**하는 쪽으로 맞추면 OpenClaw와 컨텍스트 엔지니어링 방향이 맞다.

---

## 4. 도구 스키마 변환

### 4.1 스킬 메타 → API 형식

- **현재 스킬 메타**: `{ name, description, params_schema: Record<string, string> }` (이미 `listSkills` 등으로 확보 가능).
- **OpenAI**:  
  `{ type: "function", function: { name, description, parameters: { type: "object", properties: {...}, required?: [...] } } }`  
  (`params_schema`의 key → `properties`, 값 "string" 등 → JSON Schema type)
- **Claude**:  
  tool 정의 형식이 다름. [Anthropic Messages API](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)에 맞춰 `name`, `description`, `input_schema` 등으로 변환.

**제안**: `src/llm/skill-to-tool-schema.ts` (또는 `src/tools/`)에서  
`skillMetaToOpenAITool(skill)`, `skillMetaToClaudeTool(skill)` 같은 변환 함수를 두고, 프로바이더별로 사용.

### 4.2 MCP 도구

- 1차 범위에서는 **내장 스킬 + 사용자 등록 스킬만** API `tools`에 포함.
- MCP 서버 도구는 나중에 같은 변환 레이어에 “원격 도구 → OpenAI/Claude 스키마”만 추가하면 됨.

---

## 5. LLM 레이어 변경

### 5.1 기존 유지 + 신규 추가 (모듈화)

- **기존**: `complete(prompt, model)` → 스텁/Claude/OpenAI **텍스트만** 반환. (ReAct용으로 그대로 둘 수 있음.)
- **신규**:  
  - `completeWithTools(messages, tools, model)`  
  - `src/llm/claude.ts`: Claude API에 `tools` + `tool_use` 블록 처리.  
  - `src/llm/openai.ts`: OpenAI API에 `tools` + `tool_calls` / `tool` role 처리.  
  - `src/llm/stub.ts`: tools 있으면 스텁도 “가짜 tool_calls” 반환 가능 (선택).

### 5.2 메시지 형식

- **입력 messages**:  
  `{ role: "user"|"assistant"|"system", content: string }[]`  
  + OpenAI: `role: "tool"`, `tool_call_id`, `content`  
  + Claude: assistant 메시지 내 `tool_use` 블록 + 별도 tool result 메시지  
- **에이전트 루프**에서 히스토리 + observation을 위 형식으로 맞춰서 누적.

---

## 6. 에이전트 루프 (runReact → runNativeToolLoop)

### 6.1 두 경로 공존 (모듈화)

| 경로 | 진입점 | 용도 |
|------|--------|------|
| **ReAct** | `runReact(message, history, { llm })` | 기존 동작 유지, 또는 네이티브 미지원 시 폴백 |
| **네이티브** | `runNativeToolLoop(message, history, { llmWithTools, skills })` | 새 기본 경로 |

- **설정/플래그**: 예) `USE_NATIVE_TOOL_CALLING=true` 또는 런타임에 프로바이더가 tools 지원 여부로 자동 선택.
- **채팅 라우트**:  
  - 1차: `runNativeToolLoop` 호출.  
  - 실패 시(또는 옵션 off) `runReact` 호출.

### 6.2 runNativeToolLoop 흐름 (개요)

1. `messages = [ system?, ...history, { role: "user", content: message } ]`
2. `tools = skillsToApiTools(listSkills())` (스키마 변환)
3. `response = await llmWithTools(messages, tools, model)`
4. `response.tool_calls.length === 0` → 최종 답변 반환
5. 각 `tool_call`에 대해 `registry.run(name, JSON.parse(arguments))` 실행
6. 실행 결과를 메시지에 추가 (OpenAI: `role: "tool"`, Claude: tool result 블록)
7. `messages` 갱신 후 3으로 (최대 스텝 제한 유지)

---

## 7. 모듈화 검토

### 7.1 모듈화 가능 여부: **가능**

- **LLM**:  
  - 기존 `complete()` 유지.  
  - `completeWithTools()`를 `claude.ts` / `openai.ts`에 추가하고, `llm/index.ts`에서 분기.  
  - 스텁은 tools 미지원으로 두거나, 테스트용 가짜 tool_calls 반환 선택.
- **도구 스키마**:  
  - `skillMetaToOpenAITool` / `skillMetaToClaudeTool`를 한 모듈로 분리 → 기존 `skill-tools`, `registry`는 그대로 사용.
- **에이전트**:  
  - `runReact`는 수정 최소화(기존 호출자 유지).  
  - `runNativeToolLoop`는 새 파일 `src/agent-native.ts` (또는 `src/react-native.ts`)로 두고, `react.ts`와 동일한 types·registry 의존만 사용.
- **라우트**:  
  - `POST /chat`에서만 “네이티브 우선 / ReAct 폴백” 분기 한 곳 추가.

### 7.2 의존성 방향 (변경 후)

```
routes/chat.ts
  → agent-native (runNativeToolLoop)  또는  react (runReact)
  → llm/index (completeWithTools | complete)
  → tools/skill-to-tool-schema (스킬 → API 도구 스키마)
  → skills/index (registry), tools/skill-tools (listSkills)
```

- **순환 없음**: types, registry, skill-tools, prompts는 기존처럼 유지.  
- **신규 파일**:  
  - `src/llm/skill-to-tool-schema.ts` (또는 `src/tools/`)  
  - `src/agent-native.ts` (네이티브 루프)  
  - `src/llm/claude.ts` / `openai.ts`에 tools 지원 추가.

### 7.3 단계별 적용 제안

| 단계 | 내용 |
|------|------|
| 1 | 도구 스키마 변환 모듈 추가 (`skillMetaToOpenAITool`, `skillMetaToClaudeTool`) |
| 2 | `completeWithTools` in claude.ts / openai.ts, llm/index에서 노출 |
| 3 | `runNativeToolLoop` 구현 (agent-native.ts), 메시지 형식·재호출 루프 |
| 4 | POST /chat에서 네이티브 우선 호출, 실패 시 ReAct 폴백 |
| 5 | (선택) ReAct 경로 비활성화 또는 설정으로 전환 가능하게 |

---

## 8. 리스크·참고

- **Claude / OpenAI tool 형식 차이**: 메시지 내 tool result 표현이 다름. 각 프로바이더 모듈에서만 처리하면 되므로 모듈화에 유리.
- **토큰·비용**: 동일 턴에서 여러 도구 호출 시 메시지가 길어짐. 기존과 동일하게 최대 스텝 제한으로 상한 가능.
- **하위 호환**: ReAct 경로를 유지하면 기존 동작은 설정/폴백으로 보존 가능.

---

## 9. 요약

- **도입 방향**: OpenClaw처럼 **API 네이티브 tool calling** 사용. 스킬 메타를 OpenAI/Claude 도구 스키마로 변환하고, `completeWithTools` + `runNativeToolLoop`로 multi-turn 실행.
- **모듈화**: 기존 ReAct·LLM·스킬 레이어를 건드리지 않고, **변환 모듈·네이티브 전용 LLM 시그니처·에이전트 루프를 새 모듈로 추가**하는 방식으로 가능.  
- **적용 순서**: 스키마 변환 → LLM tools 지원 → 에이전트 루프 → 채팅 라우트 연동 → (선택) ReAct 폴백 정리.

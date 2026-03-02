# messages[] user/assistant/tool 형태 전환 기획

OpenClaw처럼 대화·도구 결과를 **messages[]**에서 `user` / `assistant` / `tool` 역할로 다루도록 변경하는 기획이다.

---

## 1. 목표

- **저장·메모리**: 세션 히스토리를 `{ role: "user"|"assistant"|"tool", content: string }[]` 형태로 유지.
- **ReAct 루프**: 한 번의 사용자 발화에 대해 `user → assistant → tool → assistant → tool → … → assistant` 순서로 메시지를 쌓고, 매 스텝 이 배열을 그대로 LLM에 넘긴다.
- **API 호환**: ReAct는 텍스트만 사용하므로, `tool` 역할은 Claude/OpenAI 요청 시 **user 메시지로 변환**해 전달 (Observation 문구로 감싼다).

---

## 2. 현재 vs 변경 후

### 2.1 현재

- **저장**: `Turn[]` (role: user | assistant, content, tool_calls?). 한 “턴” = 사용자 1개 + 보조 1개. 도구 호출은 assistant의 `tool_calls` 필드에만 저장.
- **ReAct**: `history`를 `turnsToMessages()`로 user/assistant만 추려, **현재 턴**은 “User message + Observations(텍스트) + skillParamsBlock”을 담은 **단일 user 메시지**로 구성. observations는 매 스텝 문자열 배열로 쌓고, 다음 스텝에서 이걸 같은 user 메시지 안에 다시 넣음.
- **API**: `ContextMessage[]` = `user` | `assistant` 만 사용.

### 2.2 변경 후

- **저장**: 메시지 단위 배열 `Message[]` = `{ role: "user"|"assistant"|"tool", content: string }[]`. 도구 결과는 **별도 메시지**로 `role: "tool"`, `content: observation` 저장.
- **ReAct**: 
  - 초기: `messages = [...historyMessages, { role: "user", content: buildUserMessageContent(userMessage, skillParamsBlock) }]` (observations 없음).
  - 매 스텝: `completeWithContext(messages)` 호출 전에 `messages`를 API 형식으로 변환 (tool → user, “Observation: …” 형태). 응답 후 `messages`에 assistant 추가, 도구 호출 시 tool 추가. 다음 스텝에서는 이 확장된 `messages`로 다시 호출.
- **API**: 내부는 user/assistant/tool 유지. ReAct용으로는 `tool` → “Observation (tool result):\n” + content 인 **user** 메시지로 변환해 전달 (Claude/OpenAI 모두 role은 user/assistant만 사용).

---

## 3. 상세 설계

### 3.1 타입

- **Message** (신규 또는 Turn 확장): `{ role: "user" | "assistant" | "tool"; content: string }`. 필요 시 `timestamp`, `tool_calls`(assistant용 메타)는 저장용으로만 사용.
- **ContextMessage** (LLM 입력): 기존처럼 `user` | `assistant`만 허용. `messagesToApiFormat(messages: Message[]): ContextMessage[]`에서 `tool` → user 메시지로 변환.

### 3.2 DB / sessionStore

- **messages 테이블**: 기존 `role`, `content` 유지. `role`에 `'tool'` 허용.
- **getHistory(sessionId)**: `Message[]` 반환 (role 순서대로, 최근 N개 제한).
- **append**:  
  - 옵션 A: `append(sessionId, message: Message)` 한 건씩.  
  - 옵션 B: `appendMessages(sessionId, messages: Message[])`로 한 번에 여러 건.  
  채팅 플로우에서는 “user 1건 추가 → runReact → 이번 run에서 나온 assistant/tool 시퀀스 추가”이므로 옵션 B가 적합.
- **기존 append(sessionId, turn: Turn)**: 호환을 위해 `turn.role === "user"|"assistant"`만 받고, `appendMessages(sessionId, [turn])`로 위임하거나, 내부적으로 Message로 취급해 저장. 새 API는 `appendMessages`만 써도 됨.

### 3.3 프롬프트

- **buildUserMessageContent(userMessage, skillParamsBlock)**: “User message:” + skillParamsBlock + “Respond with exactly one JSON object:” 만. **Observations 블록 제거** (도구 결과는 이제 tool 메시지로 전달).
- **turnsToMessages** → **messagesToContextMessages** 또는 **messagesToApiFormat**:  
  - 입력: `Message[]`.  
  - 출력: `ContextMessage[]`.  
  - `role === "tool"`인 항목은 `{ role: "user", content: "Observation (tool result):\n" + content }` 로 변환.  
  - 길이/토큰 제한은 기존과 유사하게 (예: 최근 12턴 = user/assistant 쌍 기준이 아니라 메시지 개수로 cap).

### 3.4 react.ts

- **입력**: `history: Message[]` (기존 Turn[] 대체).
- **초기 messages 구성**:  
  `messages = [...messagesToApiFormat(history), { role: "user", content: buildUserMessageContent(userMessage, skillParamsBlock) }]`  
  단, **실제 LLM 호출 시**에는 이 배열을 한 번 더 `messagesToApiFormat`에 넣어서 tool가 있으면 user로 바꾼 뒤 전달.  
  즉 루프 안에서는 `Message[]`로만 관리하고, `completeWithContext` 호출 직전에 `messagesToApiFormat(messages)`로 변환.
- **스텝마다**:  
  1. `response = completeWithContext({ systemPrompt, messages: messagesToApiFormat(messages) }, model)`.  
  2. `messages.push({ role: "assistant", content: response })`.  
  3. 파싱 후 `action === ACTION_CALL`이면 실행, `messages.push({ role: "tool", content: observation })`.  
  4. `action === ACTION_ANSWER`이면 `return { content, tool_calls, messages: 이번 run에서 추가한 Message[] }`.
- **반환**: `{ content, tool_calls, messages: Message[] }`. `messages`는 이번 호출에서 추가한 assistant/tool 시퀀스만 (persist용).

### 3.5 chat 라우트

- `sessionStore.append(sessionId, { role: "user", content })` 1회.
- `runReact(content, history, opts)` → `{ content, tool_calls, messages }`.
- `sessionStore.appendMessages(sessionId, messages)` 로 이번 run의 assistant/tool 목록 저장.

### 3.6 기존 Turn / tool_calls

- **Turn** 타입: 하위 호환을 위해 유지하되, `role`에 `"tool"` 추가하거나, 별도 **Message** 타입을 두고 저장소·react는 Message 기준으로 통일.
- **tool_calls**: assistant 메시지에 대한 메타데이터로만 유지 (응답 JSON에 포함). 저장 시 assistant 행에 `tool_calls_json` 등으로 보관해도 됨. “이번 run에서 발생한 tool_calls”는 `runReact` 반환값에 그대로 두고, 클라이언트/로깅용으로 사용.

---

## 4. 적용 단계

1. **타입·스토어**: `Message` 타입 정의, `getHistory`가 `Message[]` 반환, `appendMessages(sessionId, Message[])` 추가. 기존 `append(sessionId, Turn)`는 Message 1건으로 처리하거나 내부에서 appendMessages 호출.
2. **프롬프트**: `buildUserMessageContent` 추가(observations 제거), `messagesToApiFormat(Message[]): ContextMessage[]` 구현.
3. **LLM**: `completeWithContext`는 계속 `ContextMessage[]`만 받음. 호출부에서 `messagesToApiFormat` 결과를 넘김.
4. **react.ts**: history를 `Message[]`로 받고, 루프 안에서 messages[]를 user/assistant/tool로 쌓고, 반환에 `messages` 포함.
5. **chat 라우트**: append user 후 runReact, 그 다음 appendMessages(result.messages).
6. **테스트**: sessionStore (getHistory/append/appendMessages), react (메시지 배열 형태), chat 라우트 통합.

---

## 5. 완료 기준

- 세션 히스토리가 DB에 user/assistant/tool 메시지 열로 저장·로드됨.
- ReAct 한 run 내에서 LLM에 넘기는 payload가 `[...history, user, assistant, tool, assistant, …]`를 “tool → user(Observation)” 변환한 형태로 전달됨.
- 기존 클라이언트 응답 형식(`content`, `tool_calls`) 유지.
- 관련 단위·통합 테스트 통과 및 커밋 완료.

---

## 6. 구현 완료 (체크리스트)

- [x] **타입**: `Message` (`user`|`assistant`|`tool`), `append(sessionId, message: Message)`, `appendMessages(sessionId, messages: Message[])`, `getHistory` → `Message[]`
- [x] **DB**: `sessionStoreDb` — role에 `tool` 저장, `appendMessages`로 다건 삽입
- [x] **프롬프트**: `buildUserMessageContent` (observations 없음), `messagesToApiFormat` (tool → user "Observation (tool result):" 변환)
- [x] **react.ts**: history를 `Message[]`로 받고, messages[]에 assistant/tool 추가, 반환에 `messages` 포함
- [x] **chat 라우트**: append(user) → runReact → appendMessages(messages)
- [x] **테스트**: sessionStore (appendMessages, role tool), agent-react (buildUserMessageContent, messagesToApiFormat), routes 통과

# OpenClaw vs ShadowClaw 아키텍처 비교

OpenClaw 아키텍처를 재분석하고, ShadowClaw와의 차이를 정리한 문서다.

---

## 1. OpenClaw 아키텍처 요약

### 1.1 워크스페이스·Bootstrap 파일

| 항목 | OpenClaw |
|------|----------|
| **워크스페이스** | `~/.openclaw/workspace` (기본). `OPENCLAW_PROFILE`이 있으면 `workspace-${profile}`. |
| **Bootstrap 파일 목록** | `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`, `memory.md` (고정 allowlist). |
| **로드 흐름** | `loadWorkspaceBootstrapFiles(dir)` → `WorkspaceBootstrapFile[]` (path, content, **missing**). **boundary-file**으로 워크스페이스 밖 경로 탈출 방지, **파일 캐시**(inode/size/mtime)로 재읽기 최소화. |
| **용량 제한** | `buildBootstrapContextFiles()`: 파일당 20k자, 전체 150k자. **missing** 파일은 `[MISSING] Expected at: path` 텍스트로 주입. |
| **추가 로직** | `resolveBootstrapContextForRun`: **bootstrap-cache**(세션별 캐시), **filterBootstrapFilesForSession**(서브에이전트/크론 시 일부 파일만), **bootstrap-hooks**(파일 내용 오버라이드). |
| **설정** | `config.agents.defaults.bootstrapMaxChars` / `bootstrapTotalMaxChars`로 제한값 변경 가능. |

### 1.2 시스템 프롬프트

| 항목 | OpenClaw |
|------|----------|
| **구성** | `buildAgentSystemPrompt(params)` 단일 진입. **PromptMode**: `full` / `minimal` / `none`. |
| **섹션 순서** | Identity → **Tooling**(이름+한줄요약, core + external) → Tool Call Style → **Safety** → OpenClaw CLI → **Skills (mandatory)**(SKILL.md 읽기 규칙) → **Memory Recall** → Docs → **Workspace** → Authorized Senders → Time → Reply Tags → Messaging → **Reactions** → **Project Context**(contextFiles) → **Silent Replies** → **Heartbeats** → **Runtime**. |
| **도구** | 시스템에는 **도구 이름 + 요약**만. 실제 스키마는 API `tools` 파라미터(네이티브 tool calling). |
| **Project Context** | `contextFiles`: `# Project Context` + SOUL.md 있으면 "embody its persona and tone" 문구 + `## ${file.path}` + content. |
| **워크스페이스 경로** | `workspaceDir`, sandbox 시 `containerWorkspaceDir` 구분. **sanitizeForPromptLiteral**로 프롬프트 삽입 시 이스케이프. |

### 1.3 도구 호출·세션

| 항목 | OpenClaw |
|------|----------|
| **도구 호출 방식** | **네이티브** API: `tools` 배열 + 응답의 `tool_calls` / `tool_use`를 그대로 파싱 후 실행. |
| **메시지 형식** | `messages[]`: `user` / `assistant` / `tool`(또는 provider별 tool_use). 도구 결과는 **메시지로 추가** 후 재호출. |
| **트랜스크립트 위생** | `sanitizeSessionHistory`, `dropThinkingBlocks`, `sanitizeToolUseResultPairing`, `sanitizeToolCallIdsForCloudCodeAssist` 등으로 role 순서·tool id·thinking 블록 정리. |
| **세션 저장** | Pi 코어: 세션 파일(JSONL 등) + SessionManager. 히스토리는 **메시지 배열**로 유지. |

### 1.4 기타

- **Skills**: 워크스페이스 `AGENTS.md` + SKILL 디렉터리. "정확히 하나의 스킬이 적용되면 해당 SKILL.md를 read로 읽고 따르라"는 **규칙**이 시스템 프롬프트에 있음.
- **Memory**: `memory_search` / `memory_get` 도구 + MEMORY.md. 시스템에 "Memory Recall" 섹션으로 사용 규칙 명시.
- **Heartbeat / Silent reply**: 시스템에 토큰·규칙 하드코딩.
- **Runtime**: agentId, host, repo, model 등 한 줄로 시스템 끝에.

---

## 2. ShadowClaw 현재 상태 요약

| 영역 | ShadowClaw |
|------|------------|
| **워크스페이스** | `resolveWorkspaceDir()`: `SHADOWCLAW_WORKSPACE_DIR` 또는 `process.cwd()`. |
| **Bootstrap 파일** | `context-files.ts`: **AGENTS.md, SOUL.md, USER.md, MEMORY.md, IDENTITY.md** 5종. AGENTS.md = 워크스페이스/에이전트 설명 한 편 → 통째로 컨텍스트. |
| **로드** | `loadContextFiles(workspaceDir)`: 허용 파일명만 읽음. **캐시 없음**. **boundary-file 없음** — `path.relative`로 `..` 탈출만 방지. **missing** 파일은 무시(주입 안 함). |
| **용량** | 파일당 20k자, 전체 150k자. 2MB 읽기 상한. head 70% + tail 20% 트림. |
| **시스템 프롬프트** | OpenClaw와 동일 섹션: Identity → Project Context → Tooling → **Tool Call Style** → **Safety** → **Skills (Mandatory)** → **Memory**(hasMemoryTools 시) → **Workspace**(workspaceDir 시) → **Silent Replies** → **Heartbeats** → **Runtime**. **useNativeTools: true** 시 ReAct용 Output format 문구 생략. PromptMode: full / minimal / none. |
| **도구 호출** | **네이티브** (Pi 스타일): `runPiStyle` → `completeWithTools(systemPrompt, messages, tools, model)`. Claude/OpenAI API에 `tools` 배열 + 응답 `tool_calls`/`tool_use` 파싱 후 `registry.run()` 실행, 결과를 메시지에 추가해 재호출. 스킬 메타는 `skill-to-tool-schema.ts`로 OpenAI/Claude 도구 스키마 변환. |
| **메시지** | `MessageWithTools[]`: user / assistant(optional tool_calls) / tool(tool_call_id). 히스토리는 SQLite에서 로드 후 Pi 형식으로 변환. 도구 결과는 **role: tool** 메시지로 추가 후 재호출. |
| **세션** | SQLite (`sessions`, `messages`). role, content, **tool_calls_json**(assistant), **tool_call_id**(tool) 저장. |

---

## 3. 차이 정리 (OpenClaw 기준 “없는 것” / “다른 것”)

### 3.1 Bootstrap·Context Files

| 항목 | OpenClaw | ShadowClaw | 비고 |
|------|----------|------------|------|
| **Bootstrap 파일 수** | 9종 (AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, MEMORY, memory) | 5종 (AGENTS, SOUL, USER, MEMORY, IDENTITY) | ShadowClaw는 TOOLS, HEARTBEAT, BOOTSTRAP 미사용. |
| **missing 파일 처리** | `[MISSING] Expected at: path` 로 컨텍스트에 포함 | 없음 (파일 없으면 무시) | OpenClaw는 누락 파일도 알림. |
| **파일 읽기 보안** | `openBoundaryFile`(rootPath 밖 접근 차단) | `path.relative`로 `..` 체크만 | OpenClaw가 더 엄격. |
| **캐시** | workspace 파일 캐시(inode/size/mtime) + bootstrap-cache(세션별) | 없음 | 매 요청 디스크 읽기. |
| **세션/프로필별 필터** | `filterBootstrapFilesForSession` (서브에이전트 등에서 일부만) | 없음 | 단일 에이전트 전제. |
| **Hook 오버라이드** | `applyBootstrapHookOverrides` | 없음 | OpenClaw만 훅으로 내용 덮어쓰기. |
| **설정으로 제한값** | config로 maxChars/totalMaxChars | 코드 상수만 | ShadowClaw는 옵션으로 전달 가능하나 config 연동 없음. |

### 3.2 시스템 프롬프트 (섹션 정렬 완료)

| 항목 | OpenClaw | ShadowClaw | 비고 |
|------|----------|------------|------|
| **PromptMode** | full / minimal / none | full / minimal / none | 동일. agent-pi(runPiStyle)는 full 사용. |
| **Safety 섹션** | 있음 (목표 제한, 안전 우선 등) | 동일 문구 | |
| **Skills (mandatory)** | "한 스킬 선택 → read로 SKILL.md 읽고 따르라" | 동일: "한 스킬 적용 시 read_file로 해당 SKILL.md 읽고 따르라", skillEntries(path) 제공. | useNativeTools 시 도구 스키마는 API tools로 전달. |
| **Memory Recall** | memory_search / memory_get 사용 규칙 | hasMemoryTools 시 Memory 섹션 포함 | MEMORY.md는 contextFiles로만; 도구 없으면 섹션 생략. |
| **Workspace 경로 안내** | workspaceDir(·sandbox) 명시 | workspaceDir 전달 시 Workspace 섹션 | agent-pi에서 resolveWorkspaceDir() 전달. |
| **Silent Replies** | SILENT_REPLY_TOKEN (NO_REPLY) 규칙 | 동일 (full 모드) | |
| **Heartbeats** | HEARTBEAT_OK 규칙 | 동일 (full 모드), DEFAULT_HEARTBEAT_PROMPT | |
| **Runtime 줄** | agentId, host, model 등 | Runtime: ShadowClaw \| model=… \| host=… | runtimeInfo 옵션으로 전달. |
| **Tool Call Style** | "기본은 나레이트 없이 호출" 등 | 동일 문구 | |
| **Project Context** | 동일 (SOUL embody + ## path + content) | 동일 | |

### 3.3 도구 호출·메시지

| 항목 | OpenClaw | ShadowClaw | 비고 |
|------|----------|------------|------|
| **도구 호출** | 네이티브 API `tools` + `tool_calls` | 네이티브: `completeWithTools` + Claude/OpenAI `tools`·`tool_calls` | 동일 방식. |
| **도구 스키마** | API `tools` 배열로 전달 | API `tools` 배열 (skill-to-tool-schema로 변환) | 동일. |
| **도구 결과** | 메시지 배열에 role: tool / tool_use 블록 | 메시지 배열에 role: tool, tool_call_id | 동일. |
| **트랜스크립트 위생** | sanitizeSessionHistory, repair 등 | 없음 | OpenClaw만 위생 처리. |
| **히스토리 형식** | messages[] (user/assistant/tool) | messages[] (user/assistant/tool), SQLite에서 로드 후 변환 | 형식 통일됨. |

### 3.4 세션·스토어

| 항목 | OpenClaw | ShadowClaw | 비고 |
|------|----------|------------|------|
| **세션 저장** | Pi SessionManager + 세션 파일 | SQLite (sessions, messages), tool_calls_json·tool_call_id 저장 | 저장소만 다름, 메시지 형식은 Pi 호환. |
| **히스토리 역할** | API와 동일한 메시지 형식 | Message[] (role, content, tool_calls_json, tool_call_id) → MessageWithTools[] 변환 | 통일됨. |

### 3.5 기타

| 항목 | OpenClaw | ShadowClaw |
|------|----------|------------|
| **Skills 모델** | AGENTS.md + SKILL 디렉터리, read로 SKILL.md 로드 | OpenClaw 스타일: 스킬 요약(이름·설명·경로)만 시스템에, 본문은 read_file(`skills/<name>.md`)로 한 건씩. 레지스트리 + 가상 경로 `skills/<name>.md` → getSkillContent(name). |
| **resolveUserPath(~ 등)** | 있음 | 없음 (워크스페이스는 cwd/env 경로만) |
| **워크스페이스 온보딩** | ensureAgentWorkspace, BOOTSTRAP.md 생성 등 | 없음 |

---

## 4. 요약: ShadowClaw에서 “OpenClaw와 다른” 부분

1. **Bootstrap**: 파일 5종(AGENTS, SOUL, USER, MEMORY, IDENTITY). 캐시·boundary-file·missing 주입·hook·세션별 필터 없음.
2. **시스템 프롬프트**: OpenClaw와 동일 섹션 적용. useNativeTools 시 ReAct용 Output format 문구만 생략.
3. **도구**: 네이티브 tool calling 적용(completeWithTools, runPiStyle). 트랜스크립트 위생(sanitize/repair) 없음.
4. **메시지**: messages[] (user/assistant/tool), 도구 결과는 role: tool로 반영. Pi 형식 호환.
5. **Skills**: 레지스트리 + skill-to-tool-schema로 API tools 변환. SKILL.md read 규칙은 시스템 프롬프트에 포함.
6. **워크스페이스**: 온보딩·BOOTSTRAP 생성·resolveUserPath 없음. 세션은 SQLite(파일 기반 SessionManager 미사용).

---

## 5. OpenClaw 시스템 프롬프트 섹션별 설정 이유

코드·주석·사용처를 기준으로, 각 섹션이 **왜** 들어갔는지 정리한다.

| 섹션 | 설정 이유 (OpenClaw 코드 기준) |
|------|--------------------------------|
| **Safety** | 에이전트 행동 가드레일. 코드 주석: *"(Inspired by Anthropic's constitution)"*. 자기보존·복제·자원 획득·권력 추구 금지, 완료보다 안전·사람 감독 우선, stop/pause/audit 준수, safeguards 우회·변조 금지. **이유**: LLM이 도구·파일·네트워크에 접근할 때 목표 이탈·남용을 막기 위한 명시적 규칙. |
| **Skills (mandatory)** | 워크스페이스 `AGENTS.md` + SKILL 디렉터리 모델. "available_skills description을 스캔 → 정확히 하나 적용되면 **read**로 해당 SKILL.md 읽고 따르라, 여러 개면 가장 구체적인 것만 선택 후 읽기, 없으면 SKILL.md 읽지 마라." **이유**: 스킬을 “파일로 관리하고, 필요할 때만 한 개 읽어서 실행”하게 해 토큰·혼선을 줄이고, 도구(read) 사용 규칙을 한 곳에 고정. |
| **Memory 규칙** | `memory_search` / `memory_get` 도구가 **있을 때만** 주입. "prior work, decisions, dates, people, preferences, todos 관련 답변 전에 MEMORY.md + memory/*.md에 memory_search → memory_get으로 필요한 줄만 가져와라. citations on/off에 따라 Source: path#line 포함 여부." **이유**: 메모리 도구가 있을 때만 “먼저 검색 후 인용” 플로우를 시스템에 알려, 휴먼 대화처럼 기억을 참조하게 함. |
| **Workspace** | `displayWorkspaceDir`(또는 sandbox면 container 경로) + "파일 작업의 기준 디렉터리" 안내. 샌드박스면 host vs container 경로 구분 문구. **이유**: read/write/edit 등 **파일 경로 해석 기준**을 에이전트에게 명시해, 상대 경로·절대 경로 혼동을 줄임. |
| **Silent Replies** | 토큰 `NO_REPLY`(SILENT_REPLY_TOKEN). "말할 게 없으면 **오직** 이 토큰만 응답하라. 실제 답변에 이 토큰 붙이지 마라." **이유**: `message` 도구로 이미 사용자에게 보낸 뒤, 에이전트가 **같은 내용을 한 번 더 채팅으로 보내는 중복**을 막기 위함. gateway/server-chat, Slack send 등에서 `isSilentReplyText()`로 이 토큰이면 **전송을 하지 않음**. |
| **Heartbeats** | gateway가 주기적으로 "할 일 있나?" 폴링할 때 쓰는 **유저 메시지**에 대한 규칙. `resolveHeartbeatPrompt()`(기본: HEARTBEAT.md 따르고 할 일 없으면 `HEARTBEAT_OK`만 답하라). **이유**: 폴링 메시지를 “일반 질문”으로 오인해 길게 답하거나 이전 대화를 반복하지 않게 하고, "할 일 없음"이면 **HEARTBEAT_OK**만 내보내게 해, 채널 쪽에서 heartbeat ack로만 처리·표시할 수 있게 함. |
| **Runtime** | agentId, host, repo, model 등 한 줄. **이유**: "지금 어떤 에이전트/호스트/모델인지"를 프롬프트에 넣어, `/status`·모델 질문·다중 에이전트 환경에서 에이전트가 자신의 컨텍스트를 인지하게 함. |
| **PromptMode** | `full`(기본) / `minimal` / `none`. **full**: 메인 세션, 모든 섹션 포함. **minimal**: `resolvePromptModeForSession(sessionKey)`에서 **서브에이전트**(`isSubagentSessionKey`)일 때 사용. compact에서는 서브에이전트·**크론** 세션도 minimal. **none**: 최소 identity 한 줄만. **이유**: 서브에이전트·크론은 “제한된 역할·짧은 컨텍스트”가 필요하므로 Safety, Silent, Heartbeat, Self-Update, Model Aliases, Reply Tags 등 **생략**해 토큰을 줄이고, 메인 에이전트 전용 규칙이 서브에이전트에 적용되지 않게 함. |

요약하면: **Safety**는 행동 제한, **Skills/Memory**는 “언제 어떤 도구를 쓰는지” 규칙, **Workspace**는 경로 해석 기준, **Silent/Heartbeat**는 **채널·폴링과의 계약**(토큰으로 응답을 구분), **Runtime**은 실행 환경 인지, **PromptMode**는 **세션 유형(메인 vs 서브/크론)에 따른 프롬프트 길이·내용 차이**를 위한 것이다.

---

## 6. OpenClaw는 ReAct 패턴을 쓰는가?

**용어 정리**  
- **ReAct 패턴(넓은 의미)**: “이유 → 행동(도구 호출) → 관찰(결과) → 반복” **루프 자체**. 이 루프는 OpenClaw와 ShadowClaw **둘 다** 한다.  
- **ReAct 프로토콜(좁은 의미, 이 문서에서 말하는 “ReAct”)**: 모델이 **응답 텍스트 안에** `{"action":"call", "skill":"...", "args":{...}}` 같은 **JSON 문자열**을 출력하고, 러너가 그걸 **파싱**해서 도구를 실행한 뒤, 결과를 다시 **텍스트(Observation)** 로 넣어 다음 턴에서 모델을 부르는 방식.

**OpenClaw는 “ReAct 프로토콜”을 쓰지 않는다.**

- **ShadowClaw(현재)**: 위의 **ReAct 프로토콜** — 모델이 JSON 문자열 출력 → 우리가 파싱 → 도구 실행 → Observation 텍스트로 재주입.
- **OpenClaw**: **네이티브 도구 호출**. API에 `tools` 배열을 넘기고, 응답은 **구조화된 `tool_calls` / `tool_use`** 로 오므로, 러너가 “JSON 문자열을 파싱”할 필요 없이 그대로 도구 디스패치 → `tool_result` 추가 → 재호출. 이 **루프 실행**을 Pi(pi-ai, pi-coding-agent)가 담당한다.  
  즉 **“ReAct 패턴”(reason→act→observe 반복)은 둘 다 따르지만**, OpenClaw는 **ReAct 프로토콜(텍스트 JSON 파싱)** 이 아니라 **API 수준의 function calling** 을 쓴다.

---

## 7. OpenClaw 사용자 요청 → 응답 흐름

진입 경로에 따라 세부는 다르지만, **공통적으로 "사용자 메시지 → runEmbeddedPiAgent → runEmbeddedAttempt → Pi 세션.prompt() → 스트리밍·도구 루프 → 결과 반환"** 이다.

| 단계 | 설명 |
|------|------|
| **1. 진입** | 사용자 메시지는 채널별로 들어온다. (CLI `openclaw agent`, Discord/Telegram/웹 등 채널, 크론, ACP 등.) 공통으로 **`runEmbeddedPiAgent({ prompt: 사용자 메시지, sessionId, sessionFile, ... })`** 가 호출된다. (CLI: `commands/agent.ts` → `runAgentAttempt` → `runEmbeddedPiAgent` / 자동 응답: `auto-reply/reply/followup-runner.ts` → `runEmbeddedPiAgent`.) |
| **2. runEmbeddedPiAgent (run.ts)** | 모델·auth·워크스페이스·타임아웃 등을 결정하고, **runEmbeddedAttempt** 를 호출한다. 실패 시 폴백 모델로 재시도할 수 있다. |
| **3. runEmbeddedAttempt (attempt.ts)** | • **세션**: `SessionManager.open(sessionFile)` 로 기존 세션 파일을 열거나 새로 만든다.  • **시스템 프롬프트**: `buildEmbeddedSystemPrompt`(bootstrap, contextFiles, skills, 도구 요약 등)으로 시스템 프롬프트 생성.  • **도구**: `createOpenClawCodingTools(...)` 로 실제 도구 구현체 목록 생성.  • **Pi 세션 생성**: `createAgentSession`(model, tools, sessionManager, system prompt 등)으로 Pi의 에이전트 세션을 만든다.  • **히스토리 정리**: `sanitizeSessionHistory`, `limitHistoryTurns`, `sanitizeToolUseResultPairing` 등으로 기존 메시지 배열을 정리한 뒤 `activeSession.agent.replaceMessages(limited)` 로 넣는다.  • **구독**: `subscribeEmbeddedPiSession` 으로 스트리밍/도구 결과/컴팩션 이벤트 구독. |
| **4. 사용자 턴 추가 및 실행** | **`activeSession.prompt(effectivePrompt)`** (이미지 있으면 `prompt(prompt, { images })`) 를 호출한다.  Pi 내부에서: (a) 사용자 메시지를 세션에 추가, (b) **streamFn**(기본 `streamSimple`, Ollama는 별도 래퍼)으로 API 호출 → (c) 응답에 **tool_calls / tool_use** 가 있으면 등록된 도구 실행 → (d) **tool_result** 를 메시지 배열에 추가 → (e) 다시 API 호출.  이 **(b)~(e) 루프**가 **ReAct가 아니라 네이티브 도구 호출 루프**다. 모델이 "JSON으로 call/answer"를 내는 게 아니라, API가 반환한 구조화된 tool 호출을 그대로 실행하고, 그 결과를 메시지로 붙여서 다음 API 호출에 넣는다. |
| **5. 컴팩션·타임아웃** | 컨텍스트 초과 등이 있으면 Pi/OpenClaw 쪽에서 **컴팩션**(이전 턴 요약·삭제) 후 재시도할 수 있다. `waitForCompactionRetry()` 로 대기. |
| **6. 결과 반환** | `runEmbeddedAttempt` 반환값(assistant 텍스트, usage, tool 호출 메타, 메시지 스냅샷 등)을 `runEmbeddedPiAgent`가 받아서, **deliverAgentCommandResult** 또는 채널별 **onBlockReply** 등으로 사용자에게 최종 응답을 보낸다. **NO_REPLY** 이면 전송 생략, **HEARTBEAT_OK** 이면 heartbeat ack 처리. |

정리하면: **사용자 메시지 → runEmbeddedPiAgent → runEmbeddedAttempt(세션 로드, 시스템 프롬프트·도구·Pi 세션 구성, 히스토리 정리) → activeSession.prompt(사용자 메시지) → Pi 내부의 "API 호출 ↔ tool_calls 실행 ↔ tool_result 추가" 루프 → 스트리밍/최종 텍스트 반환 → 채널로 전달** 이다.  
ReAct처럼 "모델이 매 턴 JSON으로 action/call을 고르는" 구조가 아니라, **한 번의 `prompt()` 호출 안에서 API 네이티브 도구 호출이 반복**되는 구조다.

---

## 8. Pi 라이브러리(pi-ai, pi-coding-agent) 사용 시점과 ShadowClaw 도입 검토

### 8.1 OpenClaw에서 Pi를 쓰는 시점

| 라이브러리 | 사용 시점 | 역할 |
|------------|-----------|------|
| **@mariozechner/pi-ai** | **에이전트 1회 런** 진입 직후 | `streamSimple`: LLM API 호출 + 응답의 **tool_calls/tool_use** 파싱·스트리밍. `runEmbeddedAttempt`에서 `activeSession.agent.streamFn = streamSimple`(또는 Ollama용 래퍼)로 주입. 그 외 `completeSimple`, `complete`, `getModel`, `convertMessages` 등은 TTS·이미지 이해·모델 목록·프로바이더 변환용. |
| **@mariozechner/pi-coding-agent** | **같은 1회 런** 안에서, prompt 호출 **직전** | `SessionManager.open(sessionFile)`: 세션 파일(JSONL 등) 열기/저장, 메시지 append, buildSessionContext. `createAgentSession(model, tools, sessionManager, ...)`: **세션 객체** 생성. 이 세션이 `.prompt(text)` 호출 시 내부에서 streamFn 호출 → tool 실행 → tool_result 추가 → 재호출 루프를 **Pi가 전담**. `DefaultResourceLoader`: 확장/리소스. |
| **@mariozechner/pi-agent-core** | 전역(타입·인터페이스) | `AgentMessage`, `AgentToolResult`, `StreamFn` 등 **타입**만 사용. 실제 런 루프는 pi-coding-agent + pi-ai. |

즉 **“사용자 메시지가 들어와서 한 번의 에이전트 런을 돌리는” 바로 그 시점**에서,  
`runEmbeddedAttempt` → `SessionManager.open` + `createAgentSession` + `activeSession.prompt(effectivePrompt)` 가 이뤄지고, 그 안에서 **pi-ai의 streamSimple**이 API 호출·도구 루프의 진입점이 된다.  
세션 파일 형식·버전(`CURRENT_SESSION_VERSION`)은 gateway/chat, auto-reply/session, config/sessions/transcript 등에서 **저장/로드 시** pi-coding-agent와 맞춰 쓴다.

### 8.2 OpenClaw는 도구를 못 등록해서 Pi로 “확장”하는가?

**아니다.** OpenClaw가 **도구를 등록하는 주체**다. `createOpenClawCodingTools(...)` 로 read, write, bash, grep, send 등 **구현체와 스키마**를 만들고, 그 목록을 `createAgentSession(..., tools: builtInTools, customTools: ...)` 에 넘긴다.  
**Pi**는 “도구를 대신 등록해 주는 라이브러리”가 아니라, **(1) 넘겨받은 도구 목록을 API 형식으로 넣어 주고, (2) API가 돌려준 `tool_calls`를 그 도구들에 디스패치하고, (3) 세션·메시지·재호출 루프를 돌리는 러너** 역할이다. 도구 확장/등록은 OpenClaw 코드에서 하고, Pi는 그 도구들을 쓰는 **에이전트 루프 + 세션**을 담당한다.

### 8.3 ShadowClaw에 Pi 도입 시 생각해볼 점

- **도입한다 = ReAct 프로토콜 제거 + 네이티브 도구 호출 + 세션 레이어 정합성**  
  Pi는 **네이티브 tool_calls** 전제라서, 지금 ShadowClaw의 **ReAct 프로토콜**(모델이 JSON 문자열 출력 → 우리가 파싱)과는 다른 스택이다. Pi를 쓰려면 (1) 그 **텍스트 JSON 파싱 루프**를 제거하고, (2) 도구를 Pi가 기대하는 스키마로 넘기고, (3) 세션 저장을 Pi SessionManager 형식으로 바꾸거나, Pi 세션 ↔ SQLite/기존 메시지 배열을 이어주는 **어댑터**를 둬야 한다.  
  (“ReAct 패턴” 자체는 버리는 게 아니라, **구현 방식**이 ReAct 프로토콜에서 네이티브 호출로 바뀌는 것이다.)

- **장점**  
  네이티브 도구 호출·스트리밍·컴팩션·세션 파일 형식 등이 Pi에 이미 있으므로, OpenClaw와 동일한 런 루프·세션 형식을 쓰면 유지보수·문서·마이그레이션 경로가 단순해진다.

- **단점·비용**  
  (1) ReAct 프로토콜 제거와 동시에 프롬프트·파서·테스트 전반 수정. (2) Pi 버전·breaking change 추적. (3) 세션을 Pi 파일로 통일할지, 기존 SQLite를 유지하고 Pi와 동기화할지 선택 필요.

- **정리**  
  **OpenClaw와 같은 스택으로 네이티브 도구 호출·세션 형식까지 맞추는 게 목표**라면 pi-ai + pi-coding-agent 도입 가치가 있다. **당분간 ReAct 프로토콜 유지**하면서 “타입만 pi-agent-core 쓰기” 정도는 가능하지만, 그건 “도입”이라기보다 타입 호환용이다.  
  본격 도입 시점은 `docs/plan-native-tool-calling.md`에서 네이티브 전환을 하기로 할 때가 적절하다.

---

이 문서는 [modularization.md](modularization.md), [pi-agent-migration.md](pi-agent-migration.md)와 함께 참고하면 된다.

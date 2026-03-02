# 모듈화 점검 및 적용 계획

유지보수를 위한 모듈 경계·단일 책임·의존성 방향 점검 결과와, 미흡 시 적용할 계획이다.

---

## 1. 현재 상태 요약

### 1.1 잘 되어 있는 부분

| 영역 | 구조 | 비고 |
|------|------|------|
| **공통 타입** | `src/types.ts` | Turn, ToolCallResult, SkillMeta 등 한 곳에서 관리 |
| **스토어** | `sessionStore.ts`, `mcpStore.ts` | 단일 책임, 의존성 최소(types만) |
| **도구 레이어** | `src/tools/` | filesystem / linux / skill-tools 분리, `index.ts`에서 re-export |
| **스킬 레지스트리** | `src/skills/registry.ts` | 순수 레지스트리(등록·조회·실행), types만 의존 |
| **프롬프트** | `src/prompts/agent-react.ts` | ReAct용 프롬프트 조립만 담당 |
| **에이전트 루프** | `src/react.ts` | runReact 단일 진입, skillTools·registry·prompts에만 의존 |
| **테스트** | `*.test.ts` | 대상 모듈과 같은 레벨 또는 colocate |

### 1.2 의존성 방향 (순환 없음)

```
index.ts → routes.ts → sessionStore, skillTools, mcpStore, llm, react, skills/index
react.ts → types, tools/skill-tools, skills/index(registry), prompts/agent-react
skills/index.ts → registry, tools/filesystem, tools/linux, tools/skill-tools
tools/skill-tools.ts → types, skills/registry
```

- `types`는 어디에서도 다른 비표준 모듈을 참조하지 않음.
- `skills/registry`는 `types`만 사용.
- `tools/*`는 서로 참조하지 않고, `skill-tools`만 `skills/registry` 참조.

---

## 2. 미흡·개선 대상

### 2.1 라우트 단일 파일 (우선 적용 권장)

**현재:** `src/routes.ts` 한 파일에 세션·스킬·채팅·MCP 라우트 + Zod 스키마 전부 포함 (~184줄).

**문제:** 도메인 추가·수정 시 한 파일만 계속 비대해짐. 스키마와 핸들러가 뒤섞여 테스트·검색이 불편.

**적용 계획:**

1. **도메인별 라우터 분리**
   - `src/routes/sessions.ts` — GET/POST/PATCH/DELETE 세션, sessionStore만 사용, 스키마 동일 파일 또는 `schemas/sessions.ts`.
   - `src/routes/skills.ts` — GET/POST/PATCH/DELETE 스킬, skillTools만 사용.
   - `src/routes/chat.ts` — POST /chat, sessionStore + llm + runReact.
   - `src/routes/mcp.ts` — MCP 서버 CRUD, mcpStore만 사용.
2. **진입점**
   - `src/routes/index.ts`: `express.Router()` 생성 후 위 라우터를 경로별로 `router.use("/sessions", sessionsRouter)` 형태로 마운트, 기존 `routes.ts`는 이 index re-export만 하거나 제거.

**결과:** 라우트·스키마 수정 시 해당 도메인 파일만 열면 됨. 통합 테스트는 기존처럼 `routes` import만 바꾸면 유지 가능.

---

### 2.2 LLM 프로바이더 혼재

**현재:** `src/llm.ts`에 스텁 응답 + Claude 호출 + OpenAI 호출이 한 파일에 있음 (~72줄).

**문제:** 프로바이더 추가·변경(모델명, 파라미터, 에러 처리) 시 한 파일을 계속 수정. 단위 테스트로 스텁/Claude/OpenAI를 각각 격리하기 어렵다.

**적용 계획:**

1. **프로바이더별 모듈**
   - `src/llm/stub.ts` — API Key 없을 때 스텁 응답 (현재 `stubResponse`).
   - `src/llm/claude.ts` — `callClaude(prompt, apiKey)` (또는 옵션 객체).
   - `src/llm/openai.ts` — `callOpenAI(prompt, apiKey)`.
2. **진입점**
   - `src/llm/index.ts`: `complete(prompt, model)`에서 환경변수 확인 후 스텁/Claude/OpenAI 분기, 기존 `llm.ts`와 동일 시그니처 유지.

**결과:** 프로바이더 추가 시 새 파일만 추가하고 `llm/index.ts`에 분기 한 줄 추가. 스텁·Claude·OpenAI 각각 단위 테스트 가능.

---

### 2.3 내장 스킬 등록 단일 파일

**현재:** `src/skills/index.ts`에 파일시스템·리눅스·스킬 관리 내장 스킬 9개가 모두 등록 (~82줄).

**문제:** 스킬 개수 증가 시 한 파일이 길어지고, 도메인(파일/쉘/스킬관리)별로 수정·리뷰가 묶임.

**적용 계획 (선택):**

1. **도메인별 등록 모듈**
   - `src/skills/builtin-filesystem.ts` — read_file, write_file, list_dir, file_exists 등록 후 `registry` export 없이 side-effect만.
   - `src/skills/builtin-linux.ts` — run_shell_command 등록.
   - `src/skills/builtin-skill-mgmt.ts` — list_skills_meta, get_skill, update_skill_meta, create_custom_skill, delete_custom_skill 등록.
2. **진입점**
   - `src/skills/index.ts`: 위 세 파일을 순서대로 `import "./builtin-filesystem.js"` 등으로만 불러오고, 마지막에 `export { registry, HITL_SKILLS }` 유지.  
   - `routes.ts`(또는 `routes/chat.ts`)에서 계속 `import "./skills/index.js"` 한 번으로 레지스트리 로딩 유지.

**결과:** 내장 스킬 추가·수정 시 해당 도메인 파일만 수정. ReAct/라우트 쪽 코드 변경 없음.

---

### 2.4 기타 (낮은 우선순위)

- **react.ts**: 현재 길이·복잡도는 허용 가능. 나중에 “파싱만” / “도구 실행만” 분리하고 싶으면 `react/parse.ts`(extractJson 등), `react/execute.ts`(executeTool)로 쪼갤 수 있음.
- **진입점 index.ts**: 정적 서빙·에러 미들웨어·헬스 체크 등이 늘어나면 `src/app.ts`(express 인스턴스 생성·라우트·미들웨어 조립)와 `src/index.ts`(dotenv + app.listen) 분리 검토.
- **테스트 MCP 서버**: `src/test-mcp-server.ts`는 이미 단일 목적·독립 모듈로 적절함.

---

## 3. 적용 순서 제안

| 단계 | 항목 | 목적 |
|------|------|------|
| 1 | 라우트 도메인별 분리 (2.1) | 라우트·스키마 수정 시 영향 범위 축소, 테스트 유지 용이 |
| 2 | LLM 프로바이더 분리 (2.2) | 스텁/Claude/OpenAI 독립 테스트, 신규 프로바이더 추가 용이 |
| 3 | 내장 스킬 등록 분리 (2.3) | 스킬 수 늘어날 때 skills/index 비대화 방지 |
| 4 | (선택) react/ 분할, app 분리 (2.4) | 필요해질 때만 적용 |

이 순서로 적용하면 기존 동작을 깨지 않으면서, 유지보수 시 "어디를 고치면 되는지"가 분명해진다.

---

## 4. OpenClaw 방식 네이티브 Tool Calling 도입

- **검토 결과**: **모듈화 가능**. 기존 ReAct·LLM·스킬 레이어를 유지한 채, 도구 스키마 변환·`completeWithTools`·`runNativeToolLoop`를 새 모듈로 추가하는 방식으로 도입 가능.
- **상세 기획·단계**: [pi-agent-migration.md](pi-agent-migration.md) 참고.


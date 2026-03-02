# ShadowClaw — 사용자가 할 수 있는 작업

서버를 띄운 뒤 **API** 또는 **웹 UI**를 통해 아래 작업을 할 수 있다.

---

## 1. 채팅 (에이전트 대화)

- **경로**: `POST /chat`
- **body**: `{ "content": "메시지", "session_id": "선택", "model": "claude" | "gpt", "force_skill": "스킬이름" }`
- **동작**:
  - `session_id` 없으면 새 세션 생성 후 해당 세션에 메시지 저장.
  - 에이전트가 **네이티브 tool calling**으로 스킬(도구)을 호출할 수 있음. 필요 시 여러 번 도구 호출 후 최종 답변 반환.
  - `model`: `claude`(기본) 또는 `gpt` — 환경변수 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` 필요. 없으면 스텁 응답.
  - `force_skill`: 특정 스킬만 쓰도록 시스템 프롬프트에 힌트.
- **응답**: `{ "session_id", "content": "에이전트 답변", "tool_calls": [...] }`

**웹 UI**: 브라우저에서 `http://127.0.0.1:5052/` (또는 개발 시 `http://127.0.0.1:5173/`) 접속 후 채팅 패널에서 메시지 입력.

---

## 2. 세션 관리

| 작업 | API | 설명 |
|------|-----|------|
| 세션 목록 | `GET /sessions` | 저장된 대화 세션 목록 (id, title, updated_at) |
| 세션 생성 | `POST /sessions` | body: `{ "title": "선택" }` → `session_id` 반환 |
| 세션 상세 | `GET /sessions/:id` | 해당 세션의 메시지 이력 조회 |
| 제목 수정 | `PATCH /sessions/:id` | body: `{ "title": "새 제목" }` |
| 세션 삭제 | `DELETE /sessions/:id` | 세션 및 메시지 삭제 |

---

## 3. 스킬(Skill) 관리

에이전트가 호출할 수 있는 **도구**를 스킬로 등록·조회·수정한다.

| 작업 | API | 설명 |
|------|-----|------|
| 스킬 목록 | `GET /skills` | 등록된 스킬 목록 (이름, 설명, params_schema). 쿼리: `exclude_builtin`, `include_disabled` |
| 스킬 조회 | `GET /skills/:name` | 단일 스킬 상세 |
| 스킬 등록 | `POST /skills` | body: `{ "name", "description", "params_schema" }` 또는 `{ "name", "content": "마크다운 본문" }` (본문에서 설명·params_schema 파싱) |
| 스킬 수정 | `PUT /skills/:name` | 메타(description 등) 또는 content(마크다운) 수정 |
| 스킬 삭제 | `DELETE /skills/:name` | 사용자 정의 스킬만 삭제 가능 (내장 스킬 제외) |

**내장 스킬**: `read_file`, `write_file`, `list_dir`, `file_exists`, `run_shell_command`, 스킬 CRUD용(`list_skills_meta`, `get_skill`, `update_skill_meta`, `create_custom_skill`, `delete_custom_skill`) 등. 채팅 시 에이전트가 이들을 **네이티브 tool calling**으로 호출한다.

---

## 4. 워크스페이스·컨텍스트 파일

프로젝트 루트(또는 `SHADOWCLAW_WORKSPACE_DIR`)에 다음 파일을 두면 **시스템 프롬프트(Project Context)**에 자동으로 포함된다.

| 파일 | 용도 |
|------|------|
| `AGENTS.md` | 워크스페이스/에이전트 설명 (한 편) |
| `SOUL.md` | 톤·페르소나. "embody its persona and tone" 문구와 함께 주입 |
| `USER.md` | 사용자 관련 맥락 |
| `MEMORY.md` | 메모/기억 관련 |
| `IDENTITY.md` | 에이전트 정체성 |

파일당·전체 용량 제한 있음. 없으면 무시된다.

---

## 5. MCP 서버 등록 (실험)

- **경로**: `POST /mcp` (등록), `GET /mcp` (목록) 등
- 외부 MCP(Model Context Protocol) 서버를 등록하면 해당 서버의 도구 목록을 가져올 수 있음.  
  **현재 채팅 에이전트**는 1차적으로 **내장 스킬 + 사용자 스킬**만 네이티브 tool로 사용하며, MCP 도구는 별도 연동 단계에서 확장 예정.

---

## 6. 테스트·헬스

- `GET /health` — API 상태 확인 (`{ "status": "ok" }`).
- `npm test` — 단위·통합 테스트 실행.

---

## 요약: 사용자 플로우

1. **설정**: `.env`에 `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` 설정.
2. **실행**: `npm run run` 또는 `npm run dev:all`.
3. **채팅**: 웹 UI 또는 `POST /chat`으로 메시지 전송 → 에이전트가 스킬을 써서 답변.
4. **스킬**: `POST /skills`로 마크다운 스킬 등록 후, 채팅에서 에이전트가 해당 도구를 호출하게 할 수 있음.
5. **세션**: `GET /sessions`, `GET /sessions/:id`로 이력 조회·관리.

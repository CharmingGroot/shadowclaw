# ShadowClaw 메뉴별 기획서

PRD: [../architecture/PRD.md](../architecture/PRD.md)

화면 단위로 디렉토리를 두고, 기능별 명세 파일로 정리한다.

---

## 메뉴 구조

| 메뉴 | 폴더 | 설명 |
|------|------|------|
| **채팅** | [chat/](chat/) | 메인 화면. 세션 목록·대화·스킬/도구 패널. 소스 연결 시 해당 소스 기반 답변. OpenClaw 방식 일처리. |
| **소스** | [sources/](sources/) | 노트북LM 스타일. 문서·URL·텍스트 소스 추가/삭제/목록, 세션별 연결. |
| **도구** | [tools/](tools/) | MCP·Skill 연동·조작·관리. 서버 등록, 도구/스킬 목록·설정. |
| **설정** | [settings/](settings/) | API Key 입력·안전 관리, 모델·기타 설정. |
| **세션** | [sessions/](sessions/) | 세션 전용 목록·관리(채팅에 통합 시 참고용). |
| **공통** | [common/](common/) | 네비게이션·반응형·빈/에러 상태·디자인. |

---

## 폴더별 문서 목록

### [chat/](chat/)
- [01-overview.md](chat/01-overview.md) — 채팅(메인) 화면 역할·구성

### [sources/](sources/)
- [01-overview.md](sources/01-overview.md) — 소스 연결 개요(노트북LM 참고)
- [02-api.md](sources/02-api.md) — 소스 CRUD·세션 연결 API
- [02-session-list.md](chat/02-session-list.md) — 세션 목록 UI·생성·전환·삭제·제목
- [03-agent-flow.md](chat/03-agent-flow.md) — OpenClaw 방식 일처리·ReAct·도구 호출·HITL
- [04-tools-panel.md](chat/04-tools-panel.md) — 우측 스킬/도구 패널·강제 사용·툴팁
- [05-api.md](chat/05-api.md) — 채팅·세션·에이전트 API

### [tools/](tools/)
- [01-overview.md](tools/01-overview.md) — 도구 화면 역할
- [02-mcp.md](tools/02-mcp.md) — MCP 서버 등록·연결·도구 목록
- [03-skills.md](tools/03-skills.md) — 스킬 목록·설정·활성화
- [04-api.md](tools/04-api.md) — MCP·스킬 관련 API
- [builtin-tools-and-skills.md](tools/builtin-tools-and-skills.md) — 내장 도구·내장 Skill 기획 (파일시스템·리눅스·스킬 관리)

### [settings/](settings/)
- [01-overview.md](settings/01-overview.md) — 설정 화면 역할
- [02-api-keys.md](settings/02-api-keys.md) — API Key 입력·저장·안전 관리
- [03-api.md](settings/03-api.md) — 설정·키 관련 API

### [sessions/](sessions/)
- [01-overview.md](sessions/01-overview.md) — 세션 전용 화면(채팅 통합 시 선택)

### [common/](common/)
- [01-navigation.md](common/01-navigation.md) — 전역 네비게이션
- [02-responsive.md](common/02-responsive.md) — 반응형·빈/에러 상태

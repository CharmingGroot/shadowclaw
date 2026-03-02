# ShadowClaw

채팅 중심 개인 AI 어시스턴트. ReAct·도구(Skill/MCP) 호출로 사용자 명령을 처리한다.

- 기획: [docs/PRD.md](docs/PRD.md), [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md)

## 기술 스택

- **TypeScript** + **Node.js**
- Express API, 세션·스킬 레지스트리 (in-memory)

## 실행

```bash
npm install
npm run build
npm start
# 또는 개발 시: npm run dev
```

기본 포트: **5052** (`PORT` 환경 변수로 변경 가능)

브라우저에서 **http://127.0.0.1:5052/** 로 접속하면 채팅 UI(세션 목록·대화·스킬 패널)를 사용할 수 있다.

## API (현재)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /health | 상태 확인 |
| GET | /sessions | 세션 목록 |
| POST | /sessions | 세션 생성 (body: `{ title? }`) |
| GET | /sessions/:id | 세션 상세 + 메시지 이력 |
| PATCH | /sessions/:id | 제목 수정 (body: `{ title }`) |
| DELETE | /sessions/:id | 세션 삭제 |
| GET | /skills | 스킬 목록 |
| POST | /chat | 메시지 전송 (body: `{ content, session_id? }`) — 현재 스텁 응답 |

## 다음 단계 (기획 기준)

- ReAct 루프 + LLM 연동
- 내장 도구(filesystem, linux, skill-tools) + Skill 래핑
- 외부 MCP 서버 등록·연결·도구 호출

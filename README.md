# ShadowClaw

채팅 중심 개인 AI 어시스턴트. ReAct·도구(Skill/MCP) 호출로 사용자 명령을 처리한다.

- 기획: [docs/PRD.md](docs/PRD.md), [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md)

## 기술 스택

- **API**: TypeScript + Node.js, Express, 세션·스킬 레지스트리 (in-memory)
- **UI**: Vite + React + TypeScript + Tailwind CSS

## 실행

```bash
npm install
npm run build
npm start
# 또는 개발 시: npm run dev
```

**LLM API Key**: 화면에서 입력하지 않음. 서버 실행 전 환경변수로 설정.

- **설정 파일**: 프로젝트 루트에 `.env` 파일 생성. (예시는 [.env.example](.env.example) 참고.)
- Claude: `ANTHROPIC_API_KEY=sk-ant-...`
- OpenAI: `OPENAI_API_KEY=sk-proj-...`

`npm run dev` / `npm start` 시 `dotenv`가 `.env`를 자동 로드. 미설정 시 채팅은 스텁 응답만 반환.

기본 포트: **5052** (API), **5173** (UI 개발 서버)

- **프로덕션**: `npm run build` (API) 후 `npm run build:web` (UI 빌드 → `public/`) → `npm start` → http://127.0.0.1:5052/
- **개발**: 터미널 1에서 `npm run dev` (API), 터미널 2에서 `npm run dev:web` (Vite) → http://127.0.0.1:5173/ (API는 프록시로 5052 연동)

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

# ShadowClaw

채팅 중심 개인 AI 어시스턴트. ReAct·도구(Skill/MCP) 호출로 사용자 명령을 처리한다.

- 기획: [docs/PRD.md](docs/PRD.md), [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md)

## 기술 스택

- **API**: TypeScript + Node.js, Express, 세션·스킬 레지스트리 (in-memory)
- **UI**: Vite + React + TypeScript + Tailwind CSS

## 실행

**필수: 프로젝트 루트에서 실행.**

```bash
# 처음 한 번: 의존성 설치 (루트 + 웹)
npm run install:all

# 프로덕션: 빌드 후 서버 한 번에 실행
npm run run
```

브라우저에서 **http://127.0.0.1:5052/** 로 접속.

| 스크립트 | 설명 |
|----------|------|
| `npm run install:all` | 루트 + web 의존성 한 번에 설치 |
| `npm run build:all` | API + 웹 빌드 |
| `npm run run` | 빌드 후 서버 시작 (프로덕션 한 번에) |
| `npm run dev:all` | API(5052) + Vite(5173) 동시 실행 → http://127.0.0.1:5173/ |

**LLM API Key**: 화면에서 입력하지 않음. 서버 실행 전 환경변수로 설정.

- **설정 파일**: 프로젝트 루트에 `.env` 파일 생성. (예시는 [.env.example](.env.example) 참고.)
- Claude: `ANTHROPIC_API_KEY=sk-ant-...`
- OpenAI: `OPENAI_API_KEY=sk-proj-...`

`npm run dev` / `npm start` 시 `dotenv`가 `.env`를 자동 로드. 미설정 시 채팅은 스텁 응답만 반환.

### 포트

- **5052**: API + 프로덕션 UI (정적 파일)
- **5173**: 개발용 Vite(UI만), API는 5052로 프록시

### 개발 모드 (UI 핫리로드)

**한 번에:** `npm run dev:all` → API(5052)와 Vite(5173)가 동시에 실행됨. 브라우저에서 **http://127.0.0.1:5173/** 접속.

터미널을 나누고 싶으면: 터미널 1 `npm run dev`, 터미널 2 `npm run dev:web`.

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

## 테스트용 MCP 서버

MCP 등록·ReAct 에이전트 테스트용 더미 서버. JSON-RPC 2.0 (tools/list, tools/call) over HTTP.

```bash
npm run test:mcp-server
# 기본 http://127.0.0.1:9999  (포트: PORT 환경변수 또는 인자로 지정)
```

제공 도구: `echo`, `add`, `multiply`, `get_time`, `reverse_string`, `uppercase` (여러 개 섞어서 ReAct 테스트에 사용 가능).  
소스: [src/test-mcp-server.ts](src/test-mcp-server.ts), 테스트: [src/test-mcp-server.test.ts](src/test-mcp-server.test.ts).

## 다음 단계 (기획 기준)

- ReAct 루프 + LLM 연동
- 내장 도구(filesystem, linux, skill-tools) + Skill 래핑
- 외부 MCP 서버 등록·연결·도구 호출

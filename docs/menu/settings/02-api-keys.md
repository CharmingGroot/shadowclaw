# 설정 — API Key

## 원칙: UI에서 관리하지 않음

- **API Key는 화면에서 입력·저장하지 않음.** 브라우저/클라이언트에 키가 남으면 노출 위험이 있음.
- 서버에서 **환경변수**로만 읽음: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

## 기능

- 설정 화면: **모델(프로바이더)** 선택만 제공 (Claude / GPT). 선택 값은 클라이언트 localStorage에 저장(키 아님).
- API Key는 서버 실행 시 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 환경변수로 설정.
- 환경변수 미설정 시 채팅은 스텁 응답으로 동작하며, 안내 메시지 노출.

# 채팅 — API

## 엔드포인트(예시)

- `POST /chat` — 메시지 전송, 에이전트 응답(스트리밍 가능).
- `GET /sessions` — 세션 목록.
- `POST /sessions` — 세션 생성.
- `PATCH /sessions/:id` — 제목 수정.
- `DELETE /sessions/:id` — 세션 삭제.
- `GET /sessions/:id/messages` — 해당 세션 대화 이력.

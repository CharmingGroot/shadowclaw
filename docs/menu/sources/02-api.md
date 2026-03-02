# 소스 — API

소스 연결 기능의 백엔드 API 예시. 구현 시 인증·파일 크기·저장소 정책에 맞춰 조정.

---

## 엔드포인트(예시)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | /sources | 소스 목록 조회(사용자/세션 단위). |
| POST | /sources | 소스 추가. body: `{ type: "file"|"url"|"text", title?, url?, content?, file? }`. |
| GET | /sources/:id | 소스 상세·내용(또는 요약) 조회. |
| DELETE | /sources/:id | 소스 삭제. |
| PATCH | /sessions/:id/sources | 세션에 연결할 소스 ID 목록 설정. body: `{ source_ids: string[] }`. |
| GET | /sessions/:id/sources | 해당 세션에 연결된 소스 목록. |

---

## 채팅 연동

- `POST /chat` 호출 시 `session_id`가 있으면 해당 세션에 연결된 소스 목록을 조회.
- 조회된 소스 내용(또는 요약/검색된 일부)을 ReAct 프롬프트의 컨텍스트 블록으로 포함.
- 소스가 없으면 기존과 동일하게 동작.

---

## 저장·보안

- 소스 메타(제목, 유형, 생성 시각) 및 내용은 서버 메모리 또는 DB에 저장. 구현 시 정책에 따라 암호화·만료 정책 적용.
- 파일 업로드 시 크기 제한, 허용 MIME 타입 제한. URL 소스는 도메인 화이트리스트 등 안전 정책 권장.

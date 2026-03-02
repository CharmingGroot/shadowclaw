# 톤/페르소나용 SOUL.md 기획

에이전트 시스템 프롬프트에 **톤·페르소나**를 관리 가능한 마크다운 파일(SOUL.md)로 주입한다.  
스킬은 작업 흐름만 담고, 어투·스타일은 이 파일로 분리한다.

---

## 1. 목표

- **SOUL.md**(또는 관리용 톤 md)를 읽어 `buildSystemPrompt`의 `tonePersonaMd`로 전달.
- 경로는 설정 가능(환경변수), 없으면 기본 경로만 시도.
- 파일이 없거나 읽기 실패 시 톤 섹션 없이 동작(기존과 동일).

---

## 2. 설계

### 2.1 파일 경로

- **기본**: `process.cwd() + "/SOUL.md"` (서버 실행 디렉터리 기준).
- **Override**: 환경변수 `SHADOWCLAW_SOUL_PATH`가 있으면 해당 경로 사용(절대 경로 또는 cwd 기준 상대 경로).

### 2.2 크기 제한

- 내용이 너무 길면 컨텍스트 낭비. **최대 32KB**(UTF-8 기준)까지만 읽고, 초과 분은 잘라내거나 무시.

### 2.3 모듈

- **`src/tone-persona.ts`**: `loadTonePersonaMd(customPath?: string): Promise<string | undefined>`.
  - 경로 결정: `customPath ?? process.env.SHADOWCLAW_SOUL_PATH ?? path.join(process.cwd(), "SOUL.md")`.
  - `fs.promises.readFile`로 읽고, `trim()`, 길이 제한 적용 후 반환. 없거나 에러 시 `undefined`.

### 2.4 연동

- **`react.ts`**: `runReact` 진입 시 `await loadTonePersonaMd()` 호출, 결과를 `buildSystemPrompt({ skillsDesc, forceSkill, tonePersonaMd })`에 전달.

---

## 3. 구현 완료

- **`src/tone-persona.ts`**: `loadTonePersonaMd(customPath?)` — env `SHADOWCLAW_SOUL_PATH` 또는 cwd/SOUL.md, 최대 32KB.
- **`src/react.ts`**: `runReact`에서 `await loadTonePersonaMd()` 후 `buildSystemPrompt({ ..., tonePersonaMd })` 전달.
- **`.env.example`**: `SHADOWCLAW_SOUL_PATH` 설명 추가.
- **테스트**: `src/tone-persona.test.ts` — 존재 파일/없음/trim/빈 파일.

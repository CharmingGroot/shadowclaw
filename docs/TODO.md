# 남은 작업 (TODO)

---

## Pi·에이전트

- [ ] **MCP 도구 연동**: 등록된 MCP 서버 도구를 채팅 에이전트 네이티브 tool 목록에 포함 (현재는 내장·사용자 스킬만 사용).
- [ ] **스트리밍 응답** (선택): 채팅 응답 스트리밍.
- [ ] **경로 A** (선택): `createAgentSession` + `SessionManager` 도입 시 authStorage/modelRegistry/settingsManager/resourceLoader 스텁 구현.
- [ ] **Bootstrap 보강** (선택): 캐시, boundary-file, missing 파일 주입, 세션별 필터 등.
- [ ] **트랜스크립트 위생** (선택): sanitizeSessionHistory, tool_use/tool_result 페어링 수리 등.

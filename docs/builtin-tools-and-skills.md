# 내장 도구(Tools)와 내장 Skill

에이전트가 호출할 수 있는 **내장 도구**를 정의하고, 각 도구를 **Skill로 감싸서** ReAct에서 사용할 수 있게 하는 설계 문서다.

- **기술 스택**: **TypeScript** + **Node.js** 런타임. 도구·스킬·MCP 클라이언트는 Node.js 서버에서 실행.

---

## 1. 개요

| 구분 | 설명 |
|------|------|
| **내장 도구 (Built-in Tools)** | 파일시스템·리눅스(쉘)·스킬 CRUD 등 **저수준 동작**을 수행하는 함수. API/레지스트리와 직접 연동. |
| **내장 Skill (Built-in Skills)** | 위 도구를 **Skill 레지스트리에 등록**한 래퍼. 에이전트는 Skill 이름 + 인자만 알면 되고, 실제 실행은 해당 도구를 호출. |

- **도구**: `src/tools/` — `filesystem`, `linux`, `skill-tools` 모듈.
- **Skill**: `src/skills/`(또는 `builtin.ts`)에서 `registry.register(..., () => tools.xxx(...))` 형태로 등록.

---

## 2. 내장 도구 정의

### 2.1 파일시스템 (tools/filesystem)

| 도구 함수 | 인자 | 설명 | 보안 |
|-----------|------|------|------|
| **read_file** | `path: string` | 파일 경로의 텍스트 내용 읽기. UTF-8. | `BASE_PATH` 이하만 허용. 상대 경로는 base 기준. |
| **write_file** | `path: string`, `content: string` | 파일에 텍스트 쓰기 (덮어쓰기). | 동일하게 base 이하만. |
| **list_dir** | `path: string` | 디렉터리 항목 목록 (이름, 타입: file/dir). | base 이하만. |
| **file_exists** | `path: string` | 파일/디렉터리 존재 여부. | base 이하만. |

- **BASE_PATH**: `process.env.SHADOWCLAW_BASE_PATH || process.cwd()`. 모든 path는 이 base 기준으로 해석하고, base 밖으로 나가는 경로는 거부.

### 2.2 리눅스/쉘 (tools/linux)

| 도구 함수 | 인자 | 설명 | 보안 |
|-----------|------|------|------|
| **run_command** | `command: string`, `timeout_sec?: number` | 쉘 명령 1개 실행. stdout + stderr 반환. | `timeout_sec` 기본 30. (추후 allowlist 옵션 가능.) |

- Windows에서는 `cmd.exe /c` 또는 PowerShell로 실행 가능하도록 구현.
- 반환: `{ stdout: string, stderr: string, exitCode: number }`.

### 2.3 스킬 조회·생성·관리 (tools/skill-tools)

| 도구 함수 | 인자 | 설명 |
|-----------|------|------|
| **list_skills** | — | 등록된 스킬 메타 목록 (레지스트리 + 오버라이드 반영). |
| **get_skill** | `name: string` | 스킬 1개 메타 조회. 없으면 null. |
| **update_skill_meta** | `name`, `description?`, `require_hitl?`, `enabled?`, `content?`(md 본문) | 스킬 메타·본문 오버라이드 저장. |
| **create_custom_skill** | `name: string`, `description: string`, `params_schema: Record<string, string>` | 사용자 정의 스킬 메타만 등록. 실행은 추후 MCP 위임 또는 스텁. |
| **delete_custom_skill** | `name: string` | 커스텀 스킬 삭제. 내장 스킬은 삭제 불가. |

- `list_skills` / `get_skill`: 레지스트리 + 오버라이드 저장소 병합 결과 반환.
- `update_skill_meta`: 오버라이드 저장소에 쓰기. `content`로 마크다운 본문 수정 가능.
- `delete_custom_skill`: 커스텀 스킬만 레지스트리에서 제거. 내장 스킬 이름이면 거부.
- `create_custom_skill`: 커스텀 스킬용 저장소에 메타만 추가. 실행 시점에는 “미구현” 또는 MCP 도구명 매핑으로 확장 가능.

---

## 3. 내장 Skill (도구 래핑)

아래 Skill은 모두 **내장 도구**를 호출하는 래퍼다. ReAct는 Skill 이름과 인자만 알고, 실제 동작은 해당 도구가 수행한다.

### 3.1 파일시스템 Skill

| Skill 이름 | 설명 | 인자 (params_schema) | 호출 도구 |
|------------|------|----------------------|-----------|
| **read_file** | 파일 내용 읽기. | `path: string` | tools.filesystem.readFile |
| **write_file** | 파일에 내용 쓰기. | `path: string`, `content: string` | tools.filesystem.writeFile |
| **list_dir** | 디렉터리 목록 조회. | `path: string` | tools.filesystem.listDir |
| **file_exists** | 파일/디렉터리 존재 여부. | `path: string` | tools.filesystem.fileExists |

### 3.2 리눅스/쉘 Skill

| Skill 이름 | 설명 | 인자 | 호출 도구 |
|------------|------|------|-----------|
| **run_shell_command** | 쉘 명령 실행. | `command: string`, `timeout_sec?: number` | tools.linux.runCommand |

### 3.3 스킬 관리 Skill

| Skill 이름 | 설명 | 인자 | 호출 도구 |
|------------|------|------|-----------|
| **list_skills_meta** | 가용 스킬 목록. | — | tools.skillTools.listSkills |
| **get_skill** | 스킬 1개 메타 조회. | `name: string` | tools.skillTools.getSkill |
| **update_skill_meta** | 스킬 설명·HITL·활성·content(md) 오버라이드 저장. | `name`, `description?`, `require_hitl?`, `enabled?`, `content?` | tools.skillTools.updateSkillMeta |
| **create_custom_skill** | 사용자 정의 스킬 메타 등록. | `name`, `description`, `params_schema` | tools.skillTools.createCustomSkill |
| **delete_custom_skill** | 커스텀 스킬 삭제(내장 스킬 불가). | `name` | tools.skillTools.deleteCustomSkill |

---

## 4. 디렉터리 구조

```
src/
  tools/
    index.ts      # re-export
    filesystem.ts # read_file, write_file, list_dir, file_exists
    linux.ts      # run_command
    skill-tools.ts# list_skills, get_skill, update_skill_meta, create_custom_skill, delete_custom_skill
  skills/
    index.ts      # 내장 도구 래핑 Skill 등록
    registry.ts   # (기존)
```

---

## 5. 요약

- **내장 도구**: filesystem(읽기/쓰기/목록/존재), linux(쉘 명령), skill-tools(조회·오버라이드·커스텀 생성).
- **내장 Skill**: 위 도구를 Skill로 등록해 에이전트가 `call(skill_name, args)` 형태로 사용.
- 보안: 파일시스템은 BASE_PATH 제한, 쉘은 timeout 필수·추후 allowlist 검토.

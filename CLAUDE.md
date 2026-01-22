# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Baleen Claude Plugins** - Claude Code용 플러그인 모음입니다. AI 보조 개발을 위한 도구들을 제공합니다.

### 주요 플러그인

- **Ralph Loop**: Ralph Wiggum 기법을 구현한 반복적 자기 참조 AI 개발 루프
- **Git Guard**: Git 워크플로우 보호 후크 - 커밋 및 PR 우회 방지, pre-commit 검증 강제
- **My Workflow**: 개인용 개발 워크플로우 자동화 (TDD, debugging, git, code review)

## Common Commands

### 테스트 실행

```bash
# 모든 테스트 실행
bats tests/

# 개별 BATS 테스트 실행
bats tests/directory_structure.bats
bats tests/marketplace_json.bats
bats tests/plugin_json.bats
bats tests/command_files.bats
bats tests/agent_files.bats
bats tests/skill_files.bats
```

### 버전 관리 & 릴리스

이 프로젝트는 **semantic-release**와 **Conventional Commits**를 사용하여 자동 버전 관리를 합니다.

#### 커밋 규칙 (Conventional Commits)

```bash
# 대화형 커밋 (권장)
npm run commit

# 또는 직접 작성
git commit -m "type(scope): description"
```

**타입 (type):**
- `feat`: 새로운 기능 (minor 버전 증가)
- `fix`: 버그 수정 (patch 버전 증가)
- `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`: 버전 증가 없음

**스코프 (scope):** 플러그인 이름 (`ralph-loop`, `git-guard`, `me`, `example-plugin`)

**예시:**
```
feat(ralph-loop): add new iteration feature
fix(git-guard): prevent commit bypass
docs(me): update TDD instructions
```

#### 자동 릴리스 흐름

1. main 브랜치에 Conventional Commits 형식으로 push
2. GitHub Actions가 테스트 실행 후 semantic-release 실행
3. 변경사항 분석 후 버전 결정 (feat → minor, fix → patch)
4. 각 `plugin.json`과 `marketplace.json` 버전 자동 업데이트
5. Git 태그 생성 및 GitHub Release 생성

### Pre-commit Hooks

```bash
# pre-commit 실행
pre-commit run --all-files
```

pre-commit은 다음을 검증합니다:
- YAML 검증
- JSON 검증
- ShellCheck (쉘 스크립트 린트)
- markdownlint (Markdown 린트)
- commitlint (커밋 메시지 형식)

> 참고: pre-commit 실패 시 `--no-verify` 옵션으로 우회할 수 없습니다.

## Architecture

### 플러그인 컴포넌트 유형

1. **Commands**: Slash commands (`commands/*.md`)
   - 사용자가 `/command-name`으로 실행
   - YAML frontmatter와 지시사항 포함

2. **Agents**: 자율 전문가 에이전트 (`agents/*.md`)
   - 특정 작업을 자율적으로 수행하는 전문가
   - 전용 도구와 모델 설정 가능

3. **Skills**: 컨텍스트 인식 가이드 (`skills/*/SKILL.md`)
   - 특정 상황에서 자동으로 활성화되는 지침
   - 도메인별 모범 사례 제공

4. **Hooks**: 이벤트 기반 자동화 (`hooks/hooks.json` + `hooks/*.sh`)
   - SessionStart, Stop 등의 이벤트에 반응
   - JSON 설정과 쉘 스크립트로 구성

### Ralph Loop 아키텍처

Ralph Loop는 **Stop hook 후킹** 메커니즘을 사용합니다:

1. **setup-ralph-loop.sh**: 상태 파일 생성 (`~/.claude/ralph-loop/ralph-loop-{session_id}.local.md`)
   - 프롬프트, 최대 반복 횟수, 완료 약속을 저장

2. **stop-hook.sh**: Claude 종료를 가로채고 루프 계속
   - 상태 파일에서 현재 반복 횟수 확인
   - 완료 약속(`<promise>TAG</promise>`) 검출
   - 마지막 어시스턴트 출력을 다음 프롬프트로 피드백
   - 최대 반복 횟수 도달 시 종료

3. **상태 저장소**: `~/.claude/ralph-loop/`
   - 세션별 상태 파일
   - `session-env.sh`에 세션 ID 저장

### Git Guard 아키텍처

Git Guard는 **Git hook 체이닝** 메커니즘을 사용합니다:

1. **SessionStart hook**: 기존 hook들 백업 후 Git Guard hook으로 교체
2. **pre-commit hook**: pre-commit 실패 시 `--no-verify` 우회를 방지
3. **pre-push hook**: PR 없이 push하는 것을 방지 (선택적)

### 명명 규칙

- **플러그인 이름**: `lowercase-with-hyphens` (소문자, 숫자, 하이픈만)
- **경로 포터빌리티**: `${CLAUDE_PLUGIN_ROOT}` 사용 (절대 경로 하드코딩 금지)
- **JSON 스키마**: `schemas/` 디렉토리 참조

### 파일 구조

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json              # Marketplace 설정
├── plugins/
│   ├── ralph-loop/                   # Ralph Wiggum 반복 개발
│   │   ├── commands/                 # Slash commands
│   │   ├── hooks/                    # SessionStart, Stop hooks
│   │   ├── scripts/                  # Setup & cancel scripts
│   │   └── .claude-plugin/plugin.json
│   ├── git-guard/                    # Git 워크플로우 보호
│   │   ├── commands/                 # Slash commands
│   │   ├── hooks/                    # Git hooks (pre-commit, pre-push)
│   │   └── .claude-plugin/plugin.json
│   └── me/                  # 개인용 개발 워크플로우 자동화
├── .github/workflows/                # CI/CD workflows
├── tests/                            # BATS 테스트
├── schemas/                          # JSON 스키마
└── docs/                             # 개발/테스트 문서
```

## Development Guidelines

### 새 플러그인 추가

1. `git-guard` 또는 기존 플러그인을 참고하여 구조 파악

2. 새 플러그인 디렉토리 생성:
   ```bash
   mkdir -p plugins/my-plugin/.claude-plugin
   mkdir -p plugins/my-plugin/commands
   mkdir -p plugins/my-plugin/hooks
   ```

3. `plugins/my-plugin/.claude-plugin/plugin.json` 작성

4. commands, agents, skills, hooks 추가

5. `.claude-plugin/marketplace.json`에 플러그인 등록

6. 테스트 실행: `bats tests/`

### 새 컴포넌트 추가

자세한 내용은 `docs/DEVELOPMENT.md` 참조:
- Commands: `commands/my-command.md`
- Agents: `agents/my-agent.md`
- Skills: `skills/my-skill/SKILL.md`
- Hooks: `hooks/hooks.json` 수정

### Hook Script 작성 시 주의사항

- **set -euo pipefail**: 항상 사용하여 에러 감지
- **jq 사용**: JSON 파싱은 항상 jq 사용 (에러 핸들링 포함)
- **PATH 변수**: `${CLAUDE_PLUGIN_ROOT}` 사용하여 포터빌리티 확보
- **에러 메시지**: stderr(`>&2`)로 출력
- **종료 코드**: 성공 시 0, 실패 시 비0 반환

## Ralph Loop 철학

1. **Iteration > Perfection**: 첫 시도에서 완벽을 목표하지 않음
2. **Failures Are Data**: 실패는 예측 가능하고 유익한 데이터
3. **Operator Skill Matters**: 성공은 좋은 모델만이 아니라 좋은 프롬프트 작성에 달림
4. **Persistence Wins**: 성공할 때까지 계속 시도

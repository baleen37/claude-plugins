---
name: isolated-test-guide
description: Docker 컨테이너에서 Claude Code를 대화형으로 테스트
---

# Claude Isolated Test

packnplay를 사용하여 격리된 Docker 환경에서 Claude Code를 실행하고 테스트합니다.

## 설치

```bash
go install github.com/obra/packnplay@latest
```

## 빠른 시작

```bash
# 현재 디렉토리에서 Claude Code 실행
packnplay run claude

# 커스텀 워크스페이스 지정
packnplay run --path /path/to/project claude

# 포트 매핑 (예: 웹 서버 테스트)
packnplay run -p 3000:3000 claude
```

## 인증 설정

packnplay는 자동으로 인증 정보를 로드합니다:

```bash
# API 키 사용 (권장)
export ANTHROPIC_API_KEY=sk-ant-xxx
packnplay run claude

# 또는 config profile 지정
packnplay run --config anthropic-work claude
```

지원하는 config 프로필: `anthropic`, `z.ai`, `anthropic-work`, `claude-personal`

## 개발 워크플로우

### 1. 기본 개발 사이클

```bash
# 새 워크트리 생성 및 컨테이너 시작
packnplay run --worktree feature-branch claude

# 개발 진행...
# (컨테이너 내에서 작업)

# 컨테이너에서 분리 (터미널 유지)
# Ctrl+B, D (tmux 사용 시)

# 나중에 재연결
packnplay attach
```

### 2. 자격 증명 마운트

```bash
# SSH 키 (git push용)
packnplay run --ssh-creds claude

# Git 설정
packnplay run --git-creds claude

# GitHub CLI
packnplay run --gh-creds claude

# 모든 자격 증명
packnplay run --all-creds claude
```

### 3. 포트 매핑

```bash
# 단일 포트
packnplay run -p 3000:3000 claude

# 여러 포트
packnplay run -p 3000:3000 -p 8080:8080 claude

# 특정 호스트 IP
packnplay run -p 127.0.0.1:3000:3000 claude
```

### 4. 컨테이너 재사용

```bash
# 실행 중인 컨테이너 목록
packnplay list

# 기존 컨테이너에 재연결
packnplay run --reconnect claude

# 특정 컨테이너 중지
packnplay stop <container_name>

# 모든 컨테이너 중지
packnplay stop --all
```

## 평가 및 벤치마킹

### 성능 테스트

```bash
# 워크트리 사용으로 격리된 테스트 환경
packnplay run --worktree eval-task-1 --reconnect claude

# 결과 수집 후 컨테이너 정리
packnplay stop --path /path/to/project
```

### 반복 테스트

```bash
# 동일 환경에서 여러 테스트 실행
for i in {1..5}; do
    packnplay run --worktree "test-$i" --no-worktree claude
done

# 결과 분석 후 일괄 정리
packnplay stop --all
```

## 고급 옵션

### 추가 환경 변수

```bash
packnplay run --env NODE_ENV=development --env DEBUG=* claude
```

### 런타임 선택

```bash
# Podman 사용
packnplay run --runtime podman claude
```

### 상세 출력

```bash
# Docker/Git 명령 표시
packnplay run --verbose claude
```

## 래퍼 스크립트 사용

`shell.sh`는 packnplay에 tmux 통합을 추가한 편의 래퍼입니다:

```bash
# 기본 실행
"${CLAUDE_PLUGIN_ROOT}/plugins/me/skills/claude-isolated-test/shell.sh"

# 포트 매핑
./shell.sh -p 3000:3000

# tmux 세션 이름 지정
./shell.sh --session mysession

# 활성 tmux 세션 목록
./shell.sh --list

# 특정 세션 종료
./shell.sh --kill mysession

# 컨테이너 정지
./shell.sh --stop
```

### 래퍼 스크립트 장점

- **tmux 자동 시작**: 컨테이너 시작 후 자동으로 tmux 세션 생성/연결
- **세션 관리**: 여러 tmux 세션을 동시에 실행 가능
- **영속성**: 컨테이너가 종료되지 않고 tmux만 분리됨

## 기존 shell.sh와의 호환성

기존 `shell.sh` 스크립트는 packnplay를 백엔드로 사용하도록 업데이트되었습니다:

```bash
"${CLAUDE_PLUGIN_ROOT}/plugins/me/skills/claude-isolated-test/shell.sh"
```

## 문제 해결

### 컨테이너가 시작되지 않음

```bash
# Docker 실행 확인
docker info

# 이미지 업데이트
packnplay refresh-container
```

### 인증 오류

```bash
# API 키 확인
echo $ANTHROPIC_API_KEY

# config 프로필 확인
packnplay configure
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :3000

# 다른 포트 사용
packnplay run -p 3001:3000 claude
```

### 워크트리 문제

```bash
# 디렉토리 직접 사용 (워크트리 건너뜀)
packnplay run --no-worktree claude
```

## 구성

packnplay 설정 파일 위치:

- 설정: `~/.config/packnplay/config.json`
- 자격 증명: `~/.local/share/packnplay/credentials/`
- 워크트리: `~/.local/share/packnplay/worktrees/`

## 참고

- 기본 컨테이너: `ghcr.io/obra/packnplay/devcontainer:latest`
- 지원 AI 에이전트: claude, codex, gemini, copilot, qwen, cursor, amp, deepseek
- 포함 도구: Node.js, GitHub CLI, GitHub Copilot, OpenAI Codex, Google Gemini, Qwen Code, Cursor CLI, Sourcegraph Amp

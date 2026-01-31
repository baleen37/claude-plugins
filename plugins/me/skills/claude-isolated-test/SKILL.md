---
name: claude-isolated-test
description: Use when you need an isolated Docker environment for Claude Code development, or to test components without polluting your local environment
---

# Claude Isolated Testing

격리된 Docker 컨테이너에서 Claude Code를 실행합니다. 로컬 환경 오염 없이 개발 및 테스트가 가능합니다.

## When to Use

- SKILL/Command/Hook 개발 및 테스트
- 재현 가능한 격리 환경 필요 시
- 로컬 환경을 깨끗하게 유지하고 싶을 때

## Helper Functions

`scripts/lib/docker-helpers.sh`:
- `check_docker_available` - Docker 가용성 확인
- `create_container` - 컨테이너 생성
- `wait_for_claude_ready` - Claude 준비 대기
- `cleanup_container` - 컨테이너 정리

## Quick Start

```bash
#!/usr/bin/env bash
set -euo pipefail

source ./scripts/lib/docker-helpers.sh

CONTAINER_NAME="claude-dev-$$-$RANDOM"
trap "cleanup_container '$CONTAINER_NAME'" EXIT

# OAuth token
TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken')

# 컨테이너 생성 및 실행
create_container "$CONTAINER_NAME" "claude-test:latest" "$TOKEN" "$(pwd)"
wait_for_claude_ready "$CONTAINER_NAME" 30

# 대화형 쉘 시작
docker exec -it "$CONTAINER_NAME" claude
```

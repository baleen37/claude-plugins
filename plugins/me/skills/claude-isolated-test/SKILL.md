---
name: claude-isolated-test
description: Use when testing Claude Code components (SKILLs, Commands, Hooks) in isolated Docker environments, needing reproducible test conditions, or testing without polluting local environment
---

# Claude Isolated Testing

Docker 컨테이너에서 Claude Code 컴포넌트를 격리된 환경에서 테스트합니다.

## When to Use

- SKILL/Command/Hook 동작 테스트
- 로컬 환경 오염 없는 테스트
- 재현 가능한 환경이 필요한 경우

## 필수 요구사항

1. **trap cleanup** - 실패 시 좀비 컨테이너 방지
   ```bash
   trap "cleanup_container '$CONTAINER_NAME'" EXIT
   ```

2. **고유 컨테이너 이름** - 동시 테스트 충돌 방지
   ```bash
   CONTAINER_NAME="claude-test-$$-$RANDOM"
   ```

3. **Docker 가용성 확인** - Docker 없으면 skip
   ```bash
   if ! check_docker_available; then
       skip "Docker not available"
   fi
   ```

4. **Health check** - 고정 지연 대신 사용
   ```bash
   wait_for_claude_ready "$CONTAINER_NAME" 30
   ```

5. **OAuth token** - Keychain에서 가져오기
   ```bash
   TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken')
   ```

## Helper 라이브러리

**docker-helpers.sh** (`scripts/lib/docker-helpers.sh`):
- `check_docker_available` - Docker 가용성 확인
- `create_container` - 컨테이너 생성
- `exec_in_container_capture` - 명령 실행 (출력 캡처)
- `wait_for_claude_ready` - Claude 준비 대기
- `cleanup_container` - 컨테이너 정리
- `container_exists`, `container_running` - 상태 확인


## 기본 패턴

```bash
#!/usr/bin/env bash
set -euo pipefail

source ./scripts/lib/docker-helpers.sh

CONTAINER_NAME="claude-test-$$-$RANDOM"
trap "cleanup_container '$CONTAINER_NAME'" EXIT

# 1. Docker 확인
check_docker_available || { echo "Docker not available"; exit 1; }

# 2. OAuth token
TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken')

# 3. 컨테이너 생성
create_container "$CONTAINER_NAME" "claude-test:latest" "$TOKEN" "$(pwd)"

# 4. 대기
wait_for_claude_ready "$CONTAINER_NAME" 30

# 5. 대화형 쉘 실행
docker exec -it "$CONTAINER_NAME" claude
```

---
name: claude-isolated-test
description: Use when testing Claude Code components (SKILLs, Commands, Hooks) in isolated Docker environments, needing reproducible test conditions, or testing without polluting local environment
---

# Claude Isolated Testing

## Overview

Use Docker containers to test Claude Code components in isolated, reproducible environments. This enables testing of Commands/Agents/SKILLs behavior, verification without local environment pollution, and CI-friendly integration with graceful Docker skip.

## CRITICAL Requirements

**MUST do for every Docker test:**

1. **ALWAYS use trap cleanup** - Without trap, failed tests leave zombie containers
   ```bash
   trap "cleanup_container '$CONTAINER_NAME'" EXIT
   ```

2. **ALWAYS use unique container names** - Without uniqueness, concurrent tests collide
   ```bash
   CONTAINER_NAME="claude-test-$$-$RANDOM"
   ```

3. **ALWAYS check Docker availability** - Don't fail hard if Docker unavailable
   ```bash
   if ! check_docker_available; then
       skip "Docker not available"
   fi
   ```

4. **PREFER health checks over sleep** - Fixed delays create slow/flaky tests
   ```bash
   wait_for_claude_ready "$CONTAINER_NAME" 30  # NOT sleep 30
   ```

5. **ALWAYS use OAuth token from Keychain** - Don't hardcode credentials
   ```bash
   TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken')
   docker run -e CLAUDE_CODE_OAUTH_TOKEN="$TOKEN" ...
   ```

**Violating any of these WILL cause problems.**

## When to Use

**Use when:**
- Testing SKILL activation and behavior
- Testing Command execution results
- Testing Hook behavior (with TTY: combine with tmux inside Docker)
- Need reproducible environment (same OS, deps, Claude version)
- Testing without polluting local ~/.claude state
- CI/CD with isolated test runs

**Don't use when:**
- Testing PreToolUse/PostToolUse hooks (use direct execution)
- Quick smoke tests (local is faster)
- Docker not available (use tmux-testing or BATS)

## Core Pattern

**Before (local testing):**
```bash
# Pollutes local state, not reproducible
claude "test this SKILL"
# modifies ~/.claude/
# can't easily rollback
```

**After (Docker isolation):**
```bash
# Clean, isolated, reproducible
CONTAINER_NAME="test-$$-$RANDOM"
TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w | jq -r '.claudeAiOauth.accessToken')
docker run --rm --name "$CONTAINER_NAME" \
  -e CLAUDE_CODE_OAUTH_TOKEN="$TOKEN" \
  -v $(pwd):/workspace \
  claude-test:latest \
  claude "test this SKILL"
# Container deleted, no local pollution
```

## Quick Reference

| Operation | Command | Purpose |
|-----------|---------|---------|
| Check Docker | `docker ps &>/dev/null` | Verify Docker daemon |
| Build image | `docker build -t claude-test ./docker` | Create test image |
| Run container | `docker run -d --name "name" image` | Start container |
| Exec in container | `docker exec "name" cmd` | Run command inside |
| Get logs | `docker logs "name"` | View container output |
| Stop container | `docker stop "name"` | Graceful shutdown |
| Remove container | `docker rm "name"` | Cleanup (use --rm to auto) |

## Test Definition Format

YAML-based test definitions (no yq dependency - use grep/sed):

```yaml
name: "Research SKILL Activation Test"
test_target:
  type: skill
  name: research
input:
  prompt: "Research TDD best practices"
expected_output:
  contains:
    - "evidence-based"
    - "systematic"
  not_contains:
    - "error"
    - "failed"
timeout: 60
```

**Full example:** `tests/example-skill-test.yaml`

## Implementation

### Helper Library: docker-helpers.sh

**Source:** `scripts/lib/docker-helpers.sh`

```bash
#!/bin/bash
set -euo pipefail

# Check Docker availability and daemon
check_docker_available() {
    command -v docker &>/dev/null && docker ps &>/dev/null
}

# Build Claude Code test image
build_claude_image() {
    local image_name="${1:-claude-test}"
    local docker_context="${2:-./docker}"
    docker build -t "$image_name" "$docker_context"
}

# Create and start container
create_container() {
    local container_name="$1"
    local image_name="$2"
    local oauth_token="$3"
    local workspace="${4:-$(pwd)}"

    docker run -d \
        --name "$container_name" \
        -e CLAUDE_CODE_OAUTH_TOKEN="$oauth_token" \
        -v "$workspace:/workspace" \
        -w /workspace \
        "$image_name" \
        sleep infinity
}

# Execute command in container (output to stdout)
exec_in_container() {
    local container_name="$1"
    shift
    docker exec "$container_name" "$@"
}

# Execute command in container (capture output)
exec_in_container_capture() {
    local container_name="$1"
    shift
    docker exec "$container_name" "$@" 2>&1
}

# Wait for Claude Code CLI to be ready
wait_for_claude_ready() {
    local container_name="$1"
    local timeout="${2:-30}"
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if docker exec "$container_name" command -v claude &>/dev/null; then
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    echo "Timeout waiting for Claude Code in container" >&2
    return 1
}

# Get container logs
get_container_logs() {
    local container_name="$1"
    docker logs "$container_name" 2>&1
}

# Cleanup container
cleanup_container() {
    local container_name="$1"
    if container_exists "$container_name"; then
        docker stop "$container_name" &>/dev/null || true
        docker rm "$container_name" &>/dev/null || true
    fi
}

# Check if container exists
container_exists() {
    local container_name="$1"
    docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"
}

# Check if container is running
container_running() {
    local container_name="$1"
    docker ps --format '{{.Names}}' | grep -q "^${container_name}$"
}
```

### Helper Library: test-helpers.sh

**Source:** `scripts/lib/test-helpers.sh`

```bash
#!/bin/bash
set -euo pipefail

# Load YAML test definition
load_test_definition() {
    local test_file="$1"
    # Simple YAML parsing using grep/sed
    TEST_NAME=$(grep '^name:' "$test_file" | sed 's/name: *//; s/"//g')
    TEST_TARGET_TYPE=$(grep -A1 '^test_target:' "$test_file" | grep 'type:' | sed 's/.*type: *//; s/\r//')
    TEST_TARGET_NAME=$(grep -A1 '^test_target:' "$test_file" | grep 'name:' | sed 's/.*name: *//; s/\r//')
    TEST_PROMPT=$(grep -A1 '^input:' "$test_file" | grep 'prompt:' | sed 's/.*prompt: *//; s/"//g')
    TEST_TIMEOUT=$(grep '^timeout:' "$test_file" | sed 's/timeout: *//')
    TEST_TIMEOUT=${TEST_TIMEOUT:-60}
}

# Verify output contains expected strings
verify_contains() {
    local output="$1"
    shift
    local expected_strings=("$@")

    for str in "${expected_strings[@]}"; do
        if ! echo "$output" | grep -qF "$str"; then
            echo "Expected output to contain: $str" >&2
            return 1
        fi
    done
    return 0
}

# Verify file exists in container
verify_file_exists() {
    local container_name="$1"
    local file_path="$2"
    docker exec "$container_name" test -f "$file_path"
}

# Verify file contains content
verify_file_contains() {
    local container_name="$1"
    local file_path="$2"
    local expected_content="$3"
    local output=$(docker exec "$container_name" cat "$file_path")
    echo "$output" | grep -qF "$expected_content"
}

# Measure execution time
measure_time() {
    local start_time=$(date +%s)
    "$@"
    local end_time=$(date +%s)
    echo $((end_time - start_time))
}

# Report test result
report_result() {
    local test_name="$1"
    local status="$2"
    local duration="${3:-0}"

    if [ "$status" = "pass" ]; then
        echo "PASS: $test_name (${duration}s)"
    else
        echo "FAIL: $test_name (${duration}s)"
    fi
}
```

### Basic Docker Test Pattern

```bash
#!/usr/bash
set -euo pipefail

# Source helper libraries
source ./scripts/lib/docker-helpers.sh
source ./scripts/lib/test-helpers.sh

CONTAINER_NAME="claude-test-$$-$RANDOM"
WORKSPACE="$(pwd)"

# Cleanup trap
trap "cleanup_container '$CONTAINER_NAME'" EXIT

# 1. Check Docker availability
if ! check_docker_available; then
    echo "Docker not available"
    exit 1
fi

# 2. Get OAuth token from Keychain
TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "Failed to get OAuth token from Keychain"
    exit 1
fi

# 3. Create container
create_container "$CONTAINER_NAME" "claude-test:latest" "$TOKEN" "$WORKSPACE"

# 4. Wait for Claude Code to be ready
wait_for_claude_ready "$CONTAINER_NAME" 30

# 5. Run test
OUTPUT=$(exec_in_container_capture "$CONTAINER_NAME" claude "test prompt")

# 6. Verify results
if verify_contains "$OUTPUT" "expected output"; then
    echo "Test passed"
else
    echo "Test failed"
    exit 1
fi
```

## Dockerfile

**Source:** `docker/Dockerfile`

```dockerfile
FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    jq \
    bash \
    tmux \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Verify installation
RUN claude --version

# Create workspace directory
WORKDIR /workspace

# Create non-root user (optional, for security)
RUN useradd -m -s /bin/bash claude && \
    chown -R claude:claude /workspace
USER claude

# Verify Claude Code works
RUN claude --help

ENTRYPOINT ["/usr/bin/env", "bash"]
```

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|----------------|------------------|
| `sleep 30` to wait for ready | Too short = race, too long = slow | Use `wait_for_claude_ready` |
| Hardcoded OAuth token | Security risk, expires | Get from Keychain each run |
| No trap cleanup | Zombie containers on failure | `trap "cleanup_container" EXIT` |
| `CONTAINER_NAME="test"` | Concurrent tests collide | `CONTAINER_NAME="test-$$-$RANDOM"` |
| Not checking Docker available | Hard failure in CI/CD | `check_docker_available` + skip |
| Mounting entire ~/.claude | Pollutes tests with local state | Use OAuth env var only |
| Using `ANTHROPIC_API_KEY` | Bypasses subscription auth | Use `CLAUDE_CODE_OAUTH_TOKEN` |

## CI/CD Considerations

**Docker may not be available in CI:**

```bash
@test "SKILL test in Docker" {
    if ! command -v docker &>/dev/null || ! docker ps &>/dev/null; then
        skip "Docker not available - run locally"
    fi

    # Docker test here
}
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Using `--rm` without trap | Script interrupted = zombie container | Always use trap cleanup |
| Forgetting to wait | Command executes before Claude ready | Use `wait_for_claude_ready` |
| Not mounting workspace | Claude can't access test files | `-v $(pwd):/workspace` |
| Using API key env var | Bypasses subscription, wrong tier | Use `CLAUDE_CODE_OAUTH_TOKEN` |
| Hardcoding image tag | Can't test multiple versions | Parameterize image name |

## Comparison with tmux-testing

| Feature | claude-isolated-test | tmux-testing |
|---------|----------------|--------------|
| **Isolation** | Full OS isolation | Process isolation |
| **TTY** | No (unless combined) | Yes |
| **Environment** | Reproducible | Local |
| **CI-friendly** | Yes (with skip) | Limited (tmux required) |
| **Setup complexity** | Higher (Dockerfile) | Lower |
| **Best for** | SKILL/Command behavior | SessionStart hooks, TTY tools |

**Can combine:** Run tmux inside Docker for both isolation + TTY.

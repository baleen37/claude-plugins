#!/usr/bin/env bash
# run-docker-test.sh: Run a Claude Code test in Docker container
set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source helper libraries
source "$SCRIPT_DIR/lib/docker-helpers.sh"
source "$SCRIPT_DIR/lib/test-helpers.sh"

# Default values
IMAGE_NAME="${CLAUDE_TEST_IMAGE:-claude-test:latest}"
TEST_FILE="${1:-}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

# Usage
usage() {
    echo "Usage: $0 <test.yaml>" >&2
    echo "" >&2
    echo "Environment variables:" >&2
    echo "  CLAUDE_TEST_IMAGE  Docker image name (default: claude-test:latest)" >&2
    echo "  WORKSPACE          Workspace directory to mount (default: current dir)" >&2
    exit 1
}

# Check arguments
if [ -z "$TEST_FILE" ]; then
    usage
fi

if [ ! -f "$TEST_FILE" ]; then
    echo "Error: Test file not found: $TEST_FILE" >&2
    exit 1
fi

# Load test definition
load_test_definition "$TEST_FILE"

echo "========================================"
echo "Running test: $TEST_NAME"
echo "========================================"
echo "Target: $TEST_TARGET_TYPE/$TEST_TARGET_NAME"
echo "Workspace: $WORKSPACE"
echo "Image: $IMAGE_NAME"
echo "Timeout: ${TEST_TIMEOUT}s"
echo "========================================"

# Generate unique container name
CONTAINER_NAME="claude-test-$$-$RANDOM"

# Cleanup trap
trap 'cleanup_container "$CONTAINER_NAME"' EXIT

# 1. Check Docker availability
if ! check_docker_available; then
    skip "Docker not available"
fi

# 2. Check if image exists, build if needed
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Image not found. Building $IMAGE_NAME..." >&2
    build_claude_image "$IMAGE_NAME" "$SCRIPT_DIR/../docker"
fi

# 3. Get OAuth token from Keychain (macOS) or environment
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"
    echo "Using OAuth token from environment" >&2
elif command -v security &>/dev/null; then
    echo "Getting OAuth token from Keychain..." >&2
    TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken' || echo "")
else
    echo "Warning: No OAuth token found. Set CLAUDE_CODE_OAUTH_TOKEN environment variable." >&2
    TOKEN=""
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    skip "OAuth token not available. Set CLAUDE_CODE_OAUTH_TOKEN or ensure Keychain has 'Claude Code-credentials'."
fi

# 4. Create container
echo "Creating container: $CONTAINER_NAME" >&2
create_container "$CONTAINER_NAME" "$IMAGE_NAME" "$TOKEN" "$WORKSPACE"

# 5. Wait for Claude Code to be ready
if ! wait_for_claude_ready "$CONTAINER_NAME" 30; then
    echo "Container logs:" >&2
    get_container_logs "$CONTAINER_NAME" >&2
    exit 1
fi

# 6. Run test
echo "Running test prompt..." >&2
START_TIME=$(date +%s)

OUTPUT=$(exec_in_container_capture "$CONTAINER_NAME" claude --dangerously-skip-permissions "$TEST_PROMPT" || true)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "========================================"
echo "Output:"
echo "========================================"
echo "$OUTPUT"
echo "========================================"

# 7. Verify results
failed=0
if [ ${#TEST_EXPECTED_CONTAINS[@]} -gt 0 ]; then
    echo "" >&2
    echo "Verifying expected outputs..." >&2
    verify_contains "$OUTPUT" "${TEST_EXPECTED_CONTAINS[@]}" || failed=1
fi
if [ ${#TEST_EXPECTED_NOT_CONTAINS[@]} -gt 0 ]; then
    echo "" >&2
    echo "Verifying unwanted strings are absent..." >&2
    verify_not_contains "$OUTPUT" "${TEST_EXPECTED_NOT_CONTAINS[@]}" || failed=1
fi
if [ $failed -eq 0 ]; then
    report_result "$TEST_NAME" "pass" "$DURATION"
    exit 0
else
    report_result "$TEST_NAME" "fail" "$DURATION"
    exit 1
fi

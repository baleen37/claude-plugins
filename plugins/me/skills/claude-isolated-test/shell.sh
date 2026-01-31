#!/usr/bin/env bash
set -euo pipefail

# ===== CONFIGURATION =====
IMAGE_NAME="${CLAUDE_TEST_IMAGE:-claude-test:latest}"
CONTAINER_NAME="${CLAUDE_CONTAINER_NAME:-claude-dev}"
SESSION_NAME="${CLAUDE_SESSION_NAME:-claude}"
WORKSPACE="${WORKSPACE:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ===== HELPER FUNCTIONS =====
check_docker_available() {
    docker info &>/dev/null
}

kill_session() {
    local container_name="$1"
    local session_name="$2"

    if ! container_running "$container_name"; then
        echo "Error: Container $container_name is not running" >&2
        return 1
    fi

    # 세션 존재 여부 확인
    if ! docker exec "$container_name" tmux list-sessions 2>/dev/null | grep -q "^${session_name}:"; then
        echo "Error: Session '$session_name' not found in container $container_name" >&2
        return 1
    fi

    echo "Killing tmux session: $session_name" >&2
    docker exec "$container_name" tmux kill-session -t "$session_name"
}

build_claude_image() {
    local image_name="$1"
    local docker_dir="$2"
    if [ ! -d "$docker_dir" ]; then
        echo "Error: Docker directory not found: $docker_dir" >&2
        return 1
    fi
    echo "Building Docker image: $image_name" >&2
    docker build -t "$image_name" "$docker_dir"
}

container_exists() {
    local container_name="$1"
    docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"
}

container_running() {
    local container_name="$1"
    docker ps --format '{{.Names}}' | grep -q "^${container_name}$"
}

create_interactive_container() {
    local container_name="$1"
    local image_name="$2"
    local auth_token="$3"
    local auth_type="${4:-oauth}"
    local workspace="${5:-$(pwd)}"

    if [ -z "$auth_token" ] || [ "$auth_token" = "null" ]; then
        echo "Error: Authentication token is empty" >&2
        return 1
    fi

    if container_running "$container_name"; then
        echo "Container $container_name is already running" >&2
        return 0
    fi

    if container_exists "$container_name"; then
        echo "Removing existing container: $container_name" >&2
        docker rm "$container_name" &>/dev/null || true
    fi

    local env_var="-e CLAUDE_CODE_OAUTH_TOKEN"
    if [ "$auth_type" = "api-key" ]; then
        env_var="-e ANTHROPIC_API_KEY"
    fi

    docker run -d \
        --name "$container_name" \
        "$env_var"="$auth_token" \
        -v "$workspace:/workspace" \
        -v "${container_name}-tmux:/tmux" \
        -e TMUX_TMPDIR=/tmux \
        -w /workspace \
        "$image_name" \
        sleep infinity
}

attach_container_claude() {
    local container_name="$1"
    local session_name="${2:-claude}"

    if ! container_running "$container_name"; then
        echo "Error: Container $container_name is not running" >&2
        return 1
    fi

    # tmux 세션 attach 또는 생성 (-A 플래그)
    docker exec -it "$container_name" tmux new-session -A -s "$session_name"
}

list_sessions() {
    local container_name="$1"

    if ! container_running "$container_name"; then
        echo "Error: Container $container_name is not running" >&2
        return 1
    fi

    if ! docker exec "$container_name" tmux list-sessions 2>/dev/null; then
        echo "No active tmux sessions in container: $container_name" >&2
        return 1
    fi
}

# ===== MAIN LOGIC =====
usage() {
    echo "Usage: $0 [options]" >&2
    echo "" >&2
    echo "Attach to a Claude Code Docker container with tmux for interactive development." >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  -n, --name NAME          Container name (default: claude-dev)" >&2
    echo "  -i, --image IMAGE        Docker image name (default: claude-test:latest)" >&2
    echo "  -w, --workspace DIR      Workspace directory to mount (default: current dir)" >&2
    echo "  -S, --session-name NAME  Tmux session name (default: claude)" >&2
    echo "  -l, --list-sessions      List active tmux sessions in the container" >&2
    echo "  -k, --kill-session NAME  Kill a specific tmux session in the container" >&2
    echo "  -s, --stop-only          Stop and remove the container without attaching" >&2
    echo "  -h, --help               Show this help" >&2
    exit 1
}

# Parse arguments
STOP_ONLY=false
LIST_SESSIONS=false
KILL_SESSION=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name) CONTAINER_NAME="$2"; shift 2 ;;
        -i|--image) IMAGE_NAME="$2"; shift 2 ;;
        -w|--workspace) WORKSPACE="$2"; shift 2 ;;
        -S|--session-name) SESSION_NAME="$2"; shift 2 ;;
        -l|--list-sessions) LIST_SESSIONS=true; shift ;;
        -k|--kill-session) KILL_SESSION="$2"; shift 2 ;;
        -s|--stop-only) STOP_ONLY=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

# List-sessions mode
if [ "$LIST_SESSIONS" = true ]; then
    if ! check_docker_available; then
        echo "Error: Docker is not available or not running" >&2
        exit 1
    fi
    list_sessions "$CONTAINER_NAME"
    exit $?
fi

# Kill-session mode
if [ -n "$KILL_SESSION" ]; then
    if ! check_docker_available; then
        echo "Error: Docker is not available or not running" >&2
        exit 1
    fi
    kill_session "$CONTAINER_NAME" "$KILL_SESSION"
    exit $?
fi

# Stop-only mode
if [ "$STOP_ONLY" = true ]; then
    if container_exists "$CONTAINER_NAME"; then
        echo "Stopping container: $CONTAINER_NAME" >&2
        docker stop "$CONTAINER_NAME" &>/dev/null || true
        docker rm "$CONTAINER_NAME" &>/dev/null || true
        echo "Container stopped and removed" >&2
    else
        echo "No container found: $CONTAINER_NAME" >&2
    fi
    exit 0
fi

# Check Docker availability
if ! check_docker_available; then
    echo "Error: Docker is not available or not running" >&2
    exit 1
fi

# Check if image exists, build if needed
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Image not found. Building $IMAGE_NAME..." >&2
    build_claude_image "$IMAGE_NAME" "$SCRIPT_DIR/docker"
fi

# Get authentication token (priority order)
AUTH_TYPE=""

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    TOKEN="$ANTHROPIC_API_KEY"
    AUTH_TYPE="api-key"
    echo "Using API key from ANTHROPIC_API_KEY environment variable" >&2
elif [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"
    AUTH_TYPE="oauth"
    echo "Using OAuth token from CLAUDE_CODE_OAUTH_TOKEN environment variable" >&2
elif [ -n "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
    TOKEN="$ANTHROPIC_AUTH_TOKEN"
    AUTH_TYPE="oauth"
    echo "Using OAuth token from ANTHROPIC_AUTH_TOKEN environment variable" >&2
elif command -v security &>/dev/null; then
    echo "Getting OAuth token from Keychain..." >&2
    TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken' || echo "")
    AUTH_TYPE="oauth"
else
    echo "Warning: No authentication token found." >&2
    TOKEN=""
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "Error: Authentication token not available." >&2
    echo "Set one of the following environment variables:" >&2
    echo "  - ANTHROPIC_API_KEY (standard API key, recommended for CI/CD)" >&2
    echo "  - CLAUDE_CODE_OAUTH_TOKEN (OAuth token)" >&2
    echo "  - ANTHROPIC_AUTH_TOKEN (OAuth token alternative)" >&2
    echo "Or ensure Keychain has 'Claude Code-credentials'." >&2
    exit 1
fi

# Create or reuse container
echo "========================================"
echo "Container: $CONTAINER_NAME"
echo "Image: $IMAGE_NAME"
echo "Workspace: $WORKSPACE"
echo "========================================" >&2

create_interactive_container "$CONTAINER_NAME" "$IMAGE_NAME" "$TOKEN" "$AUTH_TYPE" "$WORKSPACE"

echo "" >&2
echo "Attaching to container with tmux..." >&2
echo "Press Ctrl+B then D to detach without stopping the container" >&2
echo "Run '$0 --stop-only' to stop and remove the container" >&2
echo "" >&2

attach_container_claude "$CONTAINER_NAME" "$SESSION_NAME"

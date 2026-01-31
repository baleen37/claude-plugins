#!/usr/bin/env bash
set -euo pipefail

# ===== CONFIGURATION =====
SESSION_NAME="${CLAUDE_SESSION_NAME:-claude}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

# ===== PACKNPLAY HELPERS =====
check_packnplay_available() {
    command -v packnplay &>/dev/null
}

# Get packnplay container name for current workspace
get_container_name() {
    local workspace="$1"
    # packnplay generates container names as: packnplay-<basename>-<hash>
    # Use docker ps to find containers with packnplay prefix and current path mount
    docker ps --format '{{.Names}}' | grep '^packnplay-' | while read -r container; do
        if docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' 2>/dev/null | grep -q "$workspace"; then
            echo "$container"
            return 0
        fi
    done
}

# List tmux sessions inside a packnplay container
list_sessions() {
    local container_name="$1"

    if [ -z "$container_name" ]; then
        echo "Error: No packnplay container found for workspace: $WORKSPACE" >&2
        echo "Run '$0' without options to start a new container." >&2
        return 1
    fi

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        echo "Error: Container $container_name is not running" >&2
        return 1
    fi

    if ! docker exec "$container_name" tmux list-sessions 2>/dev/null; then
        echo "No active tmux sessions in container: $container_name" >&2
        return 1
    fi
}

# Kill a tmux session inside a packnplay container
kill_session() {
    local container_name="$1"
    local session_name="$2"

    if [ -z "$container_name" ]; then
        echo "Error: No packnplay container found for workspace: $WORKSPACE" >&2
        return 1
    fi

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        echo "Error: Container $container_name is not running" >&2
        return 1
    fi

    # Check if session exists
    if ! docker exec "$container_name" tmux list-sessions 2>/dev/null | grep -q "^${session_name}:"; then
        echo "Error: Session '$session_name' not found in container $container_name" >&2
        return 1
    fi

    echo "Killing tmux session: $session_name" >&2
    docker exec "$container_name" tmux kill-session -t "$session_name"
}

# Stop packnplay container
stop_container() {
    local container_name="$1"

    if [ -z "$container_name" ]; then
        echo "No packnplay container found for workspace: $WORKSPACE" >&2
        echo "Container already stopped or never started." >&2
        return 0
    fi

    echo "Stopping container: $container_name" >&2
    packnplay stop "$container_name"
}

# Attach to tmux session in packnplay container
attach_container_claude() {
    local container_name="$1"
    local session_name="${2:-claude}"

    if [ -z "$container_name" ]; then
        echo "Error: No packnplay container found for workspace: $WORKSPACE" >&2
        return 1
    fi

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        echo "Error: Container $container_name is not running" >&2
        return 1
    fi

    # Check if tmux session exists
    local session_exists
    session_exists=$(docker exec "$container_name" tmux list-sessions 2>/dev/null | grep -c "^${session_name}:" || echo "0")

    if [ "$session_exists" -eq 0 ]; then
        # Create new session with welcome message
        docker exec -it "$container_name" tmux new-session -s "$session_name" \; \
            send-keys "export PS1='\\[\\033[1;36m\\][claude] \\[\\033[0;32m\\]\\w\\[\\033[0m\\] $ '" C-m \; \
            send-keys "echo ''" C-m \; \
            send-keys "echo '  Welcome to Claude Code Container (packnplay)'" C-m \; \
            send-keys "echo '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'" C-m \; \
            send-keys "echo ''" C-m \; \
            send-keys "echo '  Commands:" C-m \; \
            send-keys "echo '    claude      - Start Claude Code interactive mode'" C-m \; \
            send-keys "echo '    Ctrl+B, D   - Detach from session (container stays running)'" C-m \; \
            send-keys "echo '    exit        - Exit shell'" C-m \; \
            send-keys "echo ''" C-m
    else
        # Attach to existing session
        docker exec -it "$container_name" tmux attach-session -t "$session_name"
    fi
}

# ===== MAIN LOGIC =====
usage() {
    cat >&2 << 'EOF'
Claude Code Container (packnplay wrapper) - Interactive Development

Usage:
  ./shell.sh [OPTIONS]

Basic:
  No options needed for default usage - starts packnplay container and attaches to tmux session

Container Options:
  -S, --session NAME      Tmux session name (default: claude)
  -p, --publish PORTS     Publish container port(s) (format: hostPort:containerPort)
                          Can be specified multiple times

Management:
  -l, --list              List active tmux sessions
  -k, --kill NAME         Kill a tmux session
  -s, --stop              Stop and remove packnplay container

Environment Variables:
  WORKSPACE                 Workspace directory (default: current dir)
  CLAUDE_SESSION_NAME       Override default tmux session name

Examples:
  ./shell.sh                           # Quick start
  ./shell.sh -p 8080:3000              # With port mapping
  ./shell.sh -p 3000:3000 -p 8080:8080 # Multiple ports
  ./shell.sh --list                    # List sessions
  ./shell.sh --kill mysession          # Kill a session
  ./shell.sh --stop                    # Stop container

Note: This script wraps packnplay. Authentication is managed by packnplay
      automatically (via ~/.local/share/packnplay/credentials/).
EOF
    exit 1
}

# Parse arguments
STOP_ONLY=false
LIST_SESSIONS=false
KILL_SESSION=""
PUBLISH_PORTS=()
while [[ $# -gt 0 ]]; do
    case $1 in
        -S|--session) SESSION_NAME="$2"; shift 2 ;;
        --session-name) SESSION_NAME="$2"; shift 2 ;;  # backward compat
        -l|--list|--list-sessions) LIST_SESSIONS=true; shift ;;
        -k|--kill) KILL_SESSION="$2"; shift 2 ;;
        --kill-session) KILL_SESSION="$2"; shift 2 ;;  # backward compat
        -s|--stop|--stop-only) STOP_ONLY=true; shift ;;
        -p|--publish) PUBLISH_PORTS+=("$2"); shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

# Check packnplay availability
if ! check_packnplay_available; then
    echo "Error: packnplay is not installed or not in PATH" >&2
    echo "Install packnplay from: https://github.com/your-repo/packnplay" >&2
    exit 1
fi

# Get current container name (if any)
CONTAINER_NAME=$(get_container_name "$WORKSPACE")

# List-sessions mode
if [ "$LIST_SESSIONS" = true ]; then
    list_sessions "$CONTAINER_NAME"
    exit $?
fi

# Kill-session mode
if [ -n "$KILL_SESSION" ]; then
    kill_session "$CONTAINER_NAME" "$KILL_SESSION"
    exit $?
fi

# Stop-only mode
if [ "$STOP_ONLY" = true ]; then
    stop_container "$CONTAINER_NAME"
    exit $?
fi

# Build packnplay run arguments
PACKNPLAY_ARGS=()
PACKNPLAY_ARGS+=("--path" "$WORKSPACE")

# Add port mappings
for port in "${PUBLISH_PORTS[@]}"; do
    PACKNPLAY_ARGS+=("--publish" "$port")
done

# Start packnplay container (will reuse existing if running)
echo "Starting packnplay container for workspace: $WORKSPACE" >&2

# Check if container already exists for this workspace
EXISTING_CONTAINER=$(get_container_name "$WORKSPACE")

if [ -z "$EXISTING_CONTAINER" ]; then
    # Start new container using packnplay with script mode (no TTY)
    # Use timeout to avoid hanging
    timeout 30 packnplay run "${PACKNPLAY_ARGS[@]}" --no-worktree -- sleep infinity &
    PACKNPLAY_PID=$!

    # Wait for container to appear
    echo "Waiting for container to start..." >&2
    retry_count=0
    while [ $retry_count -lt 30 ]; do
        sleep 1
        CONTAINER_NAME=$(get_container_name "$WORKSPACE")
        if [ -n "$CONTAINER_NAME" ]; then
            echo "Container started: $CONTAINER_NAME" >&2
            break
        fi
        ((retry_count++)) || true
    done

    # Clean up background process
    kill $PACKNPLAY_PID 2>/dev/null || true
    wait $PACKNPLAY_PID 2>/dev/null || true
else
    CONTAINER_NAME="$EXISTING_CONTAINER"
    echo "Using existing container: $CONTAINER_NAME" >&2
fi

if [ -z "$CONTAINER_NAME" ]; then
    echo "Error: Failed to get packnplay container name" >&2
    exit 1
fi

# Attach to tmux session
attach_container_claude "$CONTAINER_NAME" "$SESSION_NAME"

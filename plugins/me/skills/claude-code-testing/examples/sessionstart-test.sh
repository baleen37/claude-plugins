#!/bin/bash
# Test SessionStart and SessionStop hooks with side effect verification
# Usage: ./sessionstart-test.sh [project-dir]

set -euo pipefail

# Configuration
PROJECT_DIR="${1:-.}"
SESSION_NAME="sessionstart-test-$$-$RANDOM"
ENV_FILE="/tmp/test-env-$$"
LOG_FILE="/tmp/test-log-$$"

# Timeouts
TRUST_PROMPT_TIMEOUT=20  # 10 seconds
SESSION_START_TIMEOUT=20  # 10 seconds

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Cleanup trap
trap cleanup EXIT

cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
    rm -f "$ENV_FILE" "$LOG_FILE"
}

# Polling helper
wait_for_output() {
    local session="$1"
    local expected="$2"
    local max_attempts="${3:-20}"
    local attempts=0

    while [ $attempts -lt $max_attempts ]; do
        OUTPUT=$(tmux capture-pane -t "$session" -p)
        if echo "$OUTPUT" | grep -q "$expected"; then
            return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    echo -e "${RED}Timeout waiting for: $expected${NC}" >&2
    tmux capture-pane -t "$session" -p >&2
    return 1
}

main() {
    echo -e "${GREEN}=== Testing SessionStart/SessionStop Hooks ===${NC}"
    echo "Project: $PROJECT_DIR"
    echo "Session: $SESSION_NAME"
    echo "Env file: $ENV_FILE"
    echo ""

    # Setup environment
    export CLAUDE_ENV_FILE="$ENV_FILE"
    rm -f "$ENV_FILE" "$LOG_FILE"

    # Create tmux session
    echo -e "${YELLOW}1. Creating tmux session...${NC}"
    tmux new-session -d -s "$SESSION_NAME" -x 100 -y 30
    tmux send-keys -t "$SESSION_NAME" "cd '$PROJECT_DIR'" C-m
    echo -e "${GREEN}✅ Session created${NC}"

    # Launch Claude and wait for trust prompt
    echo -e "${YELLOW}2. Launching Claude Code...${NC}"
    tmux send-keys -t "$SESSION_NAME" "claude --debug" C-m

    echo -e "${YELLOW}3. Waiting for trust prompt...${NC}"
    if ! wait_for_output "$SESSION_NAME" "Yes, proceed" $TRUST_PROMPT_TIMEOUT; then
        echo -e "${RED}❌ Trust prompt not found${NC}"
        exit 1
    fi

    # Respond to trust prompt
    echo -e "${YELLOW}4. Accepting trust prompt...${NC}"
    tmux send-keys -t "$SESSION_NAME" C-m

    # Wait for Claude ready
    echo -e "${YELLOW}5. Waiting for Claude ready...${NC}"
    if ! wait_for_output "$SESSION_NAME" "claude-sonnet" $SESSION_START_TIMEOUT; then
        echo -e "${RED}❌ Claude did not start${NC}"
        exit 1
    fi

    # Wait for SessionStart hook to execute
    echo -e "${YELLOW}6. Waiting for SessionStart hook...${NC}"
    sleep 2

    # Verify SessionStart hook side effects
    echo -e "${YELLOW}7. Verifying SessionStart hook execution...${NC}"
    if [ -f "$ENV_FILE" ] && grep -q "SESSION_ID" "$ENV_FILE"; then
        echo -e "${GREEN}✅ SessionStart hook executed successfully${NC}"
        echo "Environment file contents:"
        cat "$ENV_FILE"
    else
        echo -e "${RED}❌ SessionStart hook did not execute${NC}"
        echo "Expected env file: $ENV_FILE"
        if [ -f "$ENV_FILE" ]; then
            echo "Actual contents:"
            cat "$ENV_FILE"
        else
            echo "File does not exist"
        fi

        # Show debug output
        echo -e "${YELLOW}Claude output:${NC}"
        tmux capture-pane -t "$SESSION_NAME" -p
        exit 1
    fi

    # Test SessionEnd by stopping session
    echo -e "${YELLOW}8. Testing SessionEnd hook...${NC}"
    tmux send-keys -t "$SESSION_NAME" "/exit" C-m
    sleep 2

    # Verify SessionEnd hook side effects
    echo -e "${YELLOW}9. Verifying SessionEnd hook execution...${NC}"
    if grep -q "SESSION_ENDED" "$ENV_FILE"; then
        echo -e "${GREEN}✅ SessionEnd hook executed successfully${NC}"
        echo "Final environment file contents:"
        cat "$ENV_FILE"
    else
        echo -e "${RED}❌ SessionEnd hook did not execute${NC}"
        echo "Final env file contents:"
        cat "$ENV_FILE"
        exit 1
    fi

    echo ""
    echo -e "${GREEN}=== All Tests Passed ===${NC}"
}

# Run main function
main "$@"

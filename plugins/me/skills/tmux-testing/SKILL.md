---
name: tmux-testing
description: Use when testing SessionStart/SessionStop hooks, interactive CLI tools requiring real TTY, or needing Claude Code session automation with trust prompt handling
---

# tmux Testing

## Overview

Use tmux to create isolated terminal sessions for testing interactive CLI tools and session-level hooks. Enables automated testing of SessionStart/SessionStop hooks, trust prompts, and TTY-required tools.

## CRITICAL Requirements

**MUST do for every tmux test:**

1. **ALWAYS use trap cleanup** - Failed tests leave zombie sessions
   ```bash
   trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT
   ```

2. **ALWAYS use `-d` flag** - Without `-d`, session blocks your terminal
   ```bash
   tmux new-session -d -s "$SESSION_NAME"  # NOT tmux new-session -s "$SESSION_NAME"
   ```

3. **ALWAYS use unique session names** - Concurrent tests collide
   ```bash
   SESSION_NAME="test-$$-$RANDOM"  # NOT SESSION_NAME="test-$$" or "test"
   ```

4. **PREFER polling over sleep** - Fixed delays create slow/flaky tests
   ```bash
   wait_for_output "$SESSION_NAME" "expected" 10  # NOT sleep 5 (10 = 5 seconds with 0.5s intervals)
   ```

**Violating any of these WILL cause problems.**

## When to Use

**Use when:**
- Testing SessionStart/SessionStop hooks
- Interactive CLI tools require real TTY (trust prompts, confirmations)
- Need to verify behavior in FRESH Claude Code session
- Tool hangs without real terminal

**Don't use when:**
- Testing PreToolUse/PostToolUse hooks (direct execution)
- Testing commands/agents/skills (use Claude Code directly)
- Simple bash scripts (use BATS or direct execution)
- CI/CD without tmux installed

## Quick Reference

| Operation | Command | Purpose |
|-----------|---------|---------|
| Create session | `tmux new-session -d -s "name" -x 80 -y 24` | Start detached session with size |
| Send keys | `tmux send-keys -t "name" "cmd" C-m` | Simulate keyboard input |
| Capture output | `tmux capture-pane -t "name" -p -S -50` | Get screen contents (50 lines scrollback) |
| Kill session | `tmux kill-session -t "name"` | Cleanup session |
| List sessions | `tmux list-sessions` | See all sessions |
| Attach session | `tmux attach-session -t "name"` | Interact directly (debugging) |

**Key sequences:**
- `C-m` = Enter key
- `C-c` = Ctrl+C (interrupt)
- `C-d` = Ctrl+D (EOF)

## Helper Function: Polling

**REQUIRED:** Include this function in all tmux tests. Replace ALL `sleep` calls with polling.

```bash
#!/bin/bash
# Wait for specific output instead of fixed delay
# Parameters: session_name, expected_text, max_attempts (default: 20 = 10 seconds)
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

    echo "Timeout after $((max_attempts / 2)) seconds waiting for: $expected" >&2
    echo "Last output:" >&2
    tmux capture-pane -t "$session" -p >&2
    return 1
}
```

## Basic Session Lifecycle

```bash
#!/bin/bash
set -euo pipefail

SESSION_NAME="test-$$-$RANDOM"

# Cleanup trap
trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

# 1. Create detached session with terminal size
tmux new-session -d -s "$SESSION_NAME" -x 80 -y 24

# 2. Send command
tmux send-keys -t "$SESSION_NAME" "your-command" C-m

# 3. Wait for command completion
wait_for_output "$SESSION_NAME" "prompt$" 4

# 4. Capture output
OUTPUT=$(tmux capture-pane -t "$SESSION_NAME" -p -S -50)
echo "$OUTPUT"

# 5. Verify results
if echo "$OUTPUT" | grep -q "expected-text"; then
    echo "✅ Test passed"
else
    echo "❌ Test failed"
    exit 1
fi
```

## Testing SessionStart Hooks

**IMPORTANT:** Claude Code requires trust prompt response. Session will hang without it.

```bash
#!/bin/bash
set -euo pipefail

SESSION_NAME="sessionstart-test-$$-$RANDOM"
ENV_FILE="/tmp/test-env-$$"
PROJECT_ROOT="/path/to/project"

# Configurable timeouts
TRUST_PROMPT_TIMEOUT=20  # 10 seconds
SESSION_START_TIMEOUT=20  # 10 seconds

trap "tmux kill-session -t '$SESSION_NAME' 2>/dev/null || true" EXIT

# Setup
export CLAUDE_ENV_FILE="$ENV_FILE"
rm -f "$ENV_FILE"

# Start Claude Code in tmux
tmux new-session -d -s "$SESSION_NAME" -x 100 -y 30
tmux send-keys -t "$SESSION_NAME" "cd $PROJECT_ROOT" C-m

# Start Claude Code and wait for trust prompt
tmux send-keys -t "$SESSION_NAME" "claude" C-m
wait_for_output "$SESSION_NAME" "Yes, proceed" $TRUST_PROMPT_TIMEOUT

# Respond to trust prompt
tmux send-keys -t "$SESSION_NAME" C-m
wait_for_output "$SESSION_NAME" "glm-4.7" $SESSION_START_TIMEOUT

# Verify SessionStart hook executed
if grep -q "STRATEGIC_COMPACT_SESSION_ID" "$ENV_FILE"; then
    echo "✅ SessionStart hook executed"
else
    echo "❌ SessionStart hook did not execute"
    exit 1
fi
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Not using `-d` flag | Session attaches, blocking automation | Always use `-d` for detached |
| Forgetting trap | Sessions accumulate on failures | `trap "tmux kill-session -t 'name'" EXIT` |
| Using `sleep` blindly | Too short = race conditions, too long = slow | Use polling or condition-based waiting |
| Not handling trust prompt | Session hangs at trust prompt | Send `yes` after Claude Code starts |
| Hardcoding session names | Concurrent tests collide | Use `test-$$-$RANDOM` |
| `test-$$` without $RANDOM | PID reuse possible in rapid tests | Always add `$RANDOM` |
| Not setting terminal size | Default size may break layout | Use `-x 80 -y 24` or similar |
| Capturing too little output | Missing verification data | Use `-S -50` to capture scrollback |

## Anti-Patterns

| Anti-Pattern | Why Wrong |
|--------------|-----------|
| `sleep 5` to wait | Race conditions OR slow tests |
| `SESSION_NAME="test"` | Concurrent tests collide |
| `SESSION_NAME="test-$$"` | PID reuse in rapid tests |
| No trap cleanup | Zombie sessions on failure |
| `tmux new-session -s name` | Blocks automation (no `-d`) |
| Ignoring trust prompt | Session hangs indefinitely |
| "In a hurry, skipping $RANDOM" | Tests collide when run in parallel |

## Debugging

When tests fail, inspect the live session:

```bash
# Attach to see what's happening
tmux attach-session -t "$SESSION_NAME"

# Detach without killing: Ctrl+B, then D
```

Or capture full output for debugging:

```bash
tmux capture-pane -t "$SESSION_NAME" -p -S -1000 > /tmp/debug-output.txt
```

## CI/CD Considerations

**tmux may not be available in CI:**

```bash
@test "SessionStart hook integration" {
    if ! command -v tmux &>/dev/null; then
        skip "tmux not available - run locally"
    fi

    # tmux test here
}
```

## Red Flags - Wrong Tool

**STOP and reconsider if:**
- You're testing PreToolUse hooks → Use direct execution
- You're testing non-interactive scripts → Use BATS
- You need this in CI without tmux → Skip or use alternative
- You're just running bash commands → Use direct execution

**tmux adds complexity.** Only use it when you genuinely need:
- Real TTY
- Session isolation
- Interactive input automation
- Fresh session state

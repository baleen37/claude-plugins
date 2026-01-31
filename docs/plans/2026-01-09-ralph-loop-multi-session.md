# Ralph Loop Multi-Session Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Ralph Loop plugin to support multiple concurrent sessions by storing loop state per-session in `~/.claude/ralph-loop/` with session-specific filenames.

**Architecture:**
- SessionStart hook stores `session_id` in `$CLAUDE_ENV_FILE` as `RALPH_SESSION_ID`
- State files stored at `~/.claude/ralph-loop/ralph-loop-{session_id}.local.md`
- Stop hook extracts session_id from hook input (not environment variable)
- Cancel command uses `$RALPH_SESSION_ID` environment variable

**Tech Stack:**
- Bash scripts for hooks and commands
- JSON parsing with `jq`
- YAML frontmatter in markdown state files

---

## Task 1: Create SessionStart Hook Script

**Files:**
- Create: `plugins/ralph-loop/hooks/session-start-hook.sh`

**Step 1: Create the hook script**

```bash
cat > plugins/ralph-loop/hooks/session-start-hook.sh << 'EOF'
#!/bin/bash
# Ralph Loop SessionStart Hook
# Stores session_id in CLAUDE_ENV_FILE for use in slash commands
set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id')

# Validate session_id
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    echo "⚠️ Ralph loop: Failed to extract session_id from hook input" >&2
    exit 0
fi

# Store in CLAUDE_ENV_FILE for use in slash commands
echo "export RALPH_SESSION_ID=\"$SESSION_ID\"" >> "$CLAUDE_ENV_FILE"

exit 0
EOF
```

**Step 2: Make the script executable**

```bash
chmod +x plugins/ralph-loop/hooks/session-start-hook.sh
```

**Step 3: Verify the script is executable**

```bash
ls -l plugins/ralph-loop/hooks/session-start-hook.sh
# Expected: -rwxr-xr-x ... session-start-hook.sh
```

**Step 4: Commit**

```bash
git add plugins/ralph-loop/hooks/session-start-hook.sh
git commit -m "feat: add SessionStart hook to store session_id in CLAUDE_ENV_FILE"
```

---

## Task 2: Update hooks.json to Include SessionStart Hook

**Files:**
- Modify: `plugins/ralph-loop/hooks/hooks.json`

**Step 1: Read current hooks.json**

```bash
cat plugins/ralph-loop/hooks/hooks.json
```

**Step 2: Update hooks.json to add SessionStart hook**

```bash
cat > plugins/ralph-loop/hooks/hooks.json << 'EOF'
{
  "description": "Ralph Loop plugin hooks for multi-session support",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start-hook.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.sh"
          }
        ]
      }
    ]
  }
}
EOF
```

**Step 3: Verify JSON is valid**

```bash
jq . plugins/ralph-loop/hooks/hooks.json
# Expected: Valid JSON output with SessionStart and Stop hooks
```

**Step 4: Commit**

```bash
git add plugins/ralph-loop/hooks/hooks.json
git commit -m "feat: add SessionStart hook to hooks.json for multi-session support"
```

---

## Task 3: Update stop-hook.sh for New State Location

**Files:**
- Modify: `plugins/ralph-loop/hooks/stop-hook.sh`

**Step 1: Read current stop-hook.sh to understand structure**

```bash
head -50 plugins/ralph-loop/hooks/stop-hook.sh
```

**Step 2: Update state file path and session_id extraction**

Replace the state file path logic (around lines 10-14):

```bash
# Read hook input from stdin (advanced stop hook API)
HOOK_INPUT=$(cat)

# Extract session_id from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id')

# Validate session_id
if [[ -z "$SESSION_ID" ]] || [[ "$SESSION_ID" == "null" ]]; then
    echo "⚠️ Ralph loop: Failed to extract session_id from hook input" >&2
    exit 0
fi

# Check if ralph-loop is active for this session
STATE_DIR="$HOME/.claude/ralph-loop"
STATE_FILE="$STATE_DIR/ralph-loop-$SESSION_ID.local.md"
if [[ ! -f "$STATE_FILE" ]]; then
    # No active loop for this session - allow exit
    exit 0
fi
```

**Step 3: Update sed command for iteration increment (around line 154)**

Find and replace the temp file path:

```bash
# Update iteration in frontmatter (portable across macOS and Linux)
# Create temp file, then atomically replace
TEMP_FILE="${STATE_FILE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$STATE_FILE"
```

**Step 4: Update error messages to reference new state file location**

Update all error message references to `RALPH_STATE_FILE` → `STATE_FILE`

**Step 5: Verify script syntax**

```bash
bash -n plugins/ralph-loop/hooks/stop-hook.sh
# Expected: No output (syntax OK)
```

**Step 6: Commit**

```bash
git add plugins/ralph-loop/hooks/stop-hook.sh
git commit -m "feat: update stop-hook to use session-based state files in ~/.claude/ralph-loop/"
```

---

## Task 4: Update setup-ralph-loop.sh for New State Location

**Files:**
- Modify: `plugins/ralph-loop/scripts/setup-ralph-loop.sh`

**Step 1: Read current setup script**

```bash
cat plugins/ralph-loop/scripts/setup-ralph-loop.sh
```

**Step 2: Add RALPH_SESSION_ID validation after argument parsing (after line 126)**

```bash
# Validate prompt is non-empty
if [[ -z "$PROMPT" ]]; then
    # ... existing error code ...
    exit 1
fi

# Validate RALPH_SESSION_ID is available
if [[ -z "${RALPH_SESSION_ID:-}" ]]; then
    echo "❌ Error: RALPH_SESSION_ID environment variable not found" >&2
    echo "" >&2
    echo " This indicates the SessionStart hook may not have run properly." >&2
    echo " Please check that hooks.json is correctly configured." >&2
    exit 1
fi
```

**Step 3: Update state file path creation (replace lines 128-145)**

```bash
# Create state directory
STATE_DIR="$HOME/.claude/ralph-loop"
mkdir -p "$STATE_DIR"

# State file with session_id
STATE_FILE="$STATE_DIR/ralph-loop-$RALPH_SESSION_ID.local.md"

# Check for existing loop in this session
if [[ -f "$STATE_FILE" ]]; then
    echo "⚠️ Warning: A Ralph loop is already active for this session" >&2
    echo " State file: $STATE_FILE" >&2
    echo " Run /cancel-ralph first to cancel the existing loop" >&2
    exit 1
fi

# Quote completion promise for YAML if it contains special chars or is not null
if [[ -n "$COMPLETION_PROMISE" ]] && [[ "$COMPLETION_PROMISE" != "null" ]]; then
    COMPLETION_PROMISE_YAML="\"$COMPLETION_PROMISE\""
else
    COMPLETION_PROMISE_YAML="null"
fi

# Create state file for stop hook (markdown with YAML frontmatter)
cat > "$STATE_FILE" <<EOF
---
iteration: 0
max_iterations: $MAX_ITERATIONS
completion_promise: $COMPLETION_PROMISE_YAML
session_id: $RALPH_SESSION_ID
---
$PROMPT
EOF
```

**Step 4: Update success message to include new state file path (around line 148)**

```bash
# Report loop started
echo "🔄 Ralph loop started (iteration 0)"
echo ""
echo "Session ID: $RALPH_SESSION_ID"
echo "State file: $STATE_FILE"
echo ""
echo "Max iterations: $MAX_ITERATIONS"
# ... rest of output ...
```

**Step 5: Verify script syntax**

```bash
bash -n plugins/ralph-loop/scripts/setup-ralph-loop.sh
# Expected: No output (syntax OK)
```

**Step 6: Commit**

```bash
git add plugins/ralph-loop/scripts/setup-ralph-loop.sh
git commit -m "feat: update setup script to use session-based state files in ~/.claude/ralph-loop/"
```

---

## Task 5: Create cancel-ralph.sh Script

**Files:**
- Create: `plugins/ralph-loop/scripts/cancel-ralph.sh`

**Step 1: Create the cancel script**

```bash
cat > plugins/ralph-loop/scripts/cancel-ralph.sh << 'EOF'
#!/bin/bash
# Ralph Loop Cancel Script
# Cancels the active Ralph loop for the current session
set -euo pipefail

# Check if RALPH_SESSION_ID is available
if [[ -z "${RALPH_SESSION_ID:-}" ]]; then
    echo "❌ Error: RALPH_SESSION_ID environment variable not found" >&2
    echo "" >&2
    echo " This indicates the SessionStart hook may not have run properly." >&2
    echo " Please check that hooks.json is correctly configured." >&2
    exit 1
fi

STATE_DIR="$HOME/.claude/ralph-loop"
STATE_FILE="$STATE_DIR/ralph-loop-$RALPH_SESSION_ID.local.md"

# Check if state file exists
if [[ ! -f "$STATE_FILE" ]]; then
    echo "No active Ralph loop found for current session (session: $RALPH_SESSION_ID)"
    exit 0
fi

# Extract iteration number
ITERATION=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$STATE_FILE" | grep '^iteration:' | sed 's/iteration: *//')

# Remove state file
rm "$STATE_FILE"

echo "Cancelled Ralph loop for session $RALPH_SESSION_ID (was at iteration $ITERATION)"
EOF
```

**Step 2: Make the script executable**

```bash
chmod +x plugins/ralph-loop/scripts/cancel-ralph.sh
```

**Step 3: Verify the script is executable**

```bash
ls -l plugins/ralph-loop/scripts/cancel-ralph.sh
# Expected: -rwxr-xr-x ... cancel-ralph.sh
```

**Step 4: Commit**

```bash
git add plugins/ralph-loop/scripts/cancel-ralph.sh
git commit -m "feat: add cancel-ralph.sh script for session-based loop cancellation"
```

---

## Task 6: Update cancel-ralph.md Command

**Files:**
- Modify: `plugins/ralph-loop/commands/cancel-ralph.md`

**Step 1: Read current cancel-ralph.md**

```bash
cat plugins/ralph-loop/commands/cancel-ralph.md
```

**Step 2: Replace entire content with new script-based approach**

```bash
cat > plugins/ralph-loop/commands/cancel-ralph.md << 'EOF'
---
description: "Cancel active Ralph Loop"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/cancel-ralph.sh)"]
hide-from-slash-command-tool: "true"
---
# Cancel Ralph
Execute the cancel script:
```!
"${CLAUDE_PLUGIN_ROOT}/scripts/cancel-ralph.sh"
```
EOF
```

**Step 3: Verify the file content**

```bash
cat plugins/ralph-loop/commands/cancel-ralph.md
# Expected: Frontmatter with script command reference
```

**Step 4: Commit**

```bash
git add plugins/ralph-loop/commands/cancel-ralph.md
git commit -m "refactor: update cancel-ralph to use script instead of inline instructions"
```

---

## Task 7: Update README.md with Multi-Session Documentation

**Files:**
- Modify: `plugins/ralph-loop/README.md`

**Step 1: Read current README to find section to update**

```bash
head -50 plugins/ralph-loop/README.md
```

**Step 2: Add Multi-Session section after Quick Start section**

Find the Quick Start section (around line 35) and add after it:

```markdown
## Multi-Session Support

Ralph Loop now supports multiple concurrent sessions. Each session maintains its own independent loop state.

### State File Location

Loop state is stored in: `~/.claude/ralph-loop/ralph-loop-{session_id}.local.md`

- **Session ID**: Automatically assigned by Claude Code
- **Isolation**: Each session's loop is completely independent
- **Concurrent Execution**: Run different Ralph loops in different terminal sessions simultaneously

### Example

```bash
# Terminal 1
/ralph-loop "Fix auth bug" --max-iterations 10

# Terminal 2 (simultaneously)
/ralph-loop "Refactor cache" --max-iterations 20

# Each terminal runs its own loop independently
```

### Canceling a Loop

Each session can only cancel its own loop:

```bash
/cancel-ralph
# Cancels only the current session's loop
```
```

**Step 3: Update state file references throughout README**

Find and replace all references to `.claude/ralph-loop.local.md` with `~/.claude/ralph-loop/ralph-loop-{session_id}.local.md`

**Step 4: Verify markdown formatting**

```bash
# Look for any malformed markdown
cat plugins/ralph-loop/README.md
```

**Step 5: Commit**

```bash
git add plugins/ralph-loop/README.md
git commit -m "docs: update README with multi-session support documentation"
```

---

## Task 8: Manual Testing

**Files:**
- Test: Manual verification in running Claude Code session

**Step 1: Test SessionStart hook**

```bash
# In a Claude Code session, check if RALPH_SESSION_ID is set
echo $RALPH_SESSION_ID
# Expected: A UUID string
```

**Step 2: Test starting a Ralph loop**

```bash
# In Claude Code session
/ralph-loop "Test loop" --max-iterations 2

# Verify state file was created
ls -la ~/.claude/ralph-loop/
# Expected: ralph-loop-{session_id}.local.md exists
```

**Step 3: Test cancel functionality**

```bash
# Cancel the loop
/cancel-ralph
# Expected: Success message with session ID

# Verify state file was deleted
ls -la ~/.claude/ralph-loop/
# Expected: State file is gone
```

**Step 4: Test multi-session (optional - requires two terminals)**

Start Ralph loops in two separate terminal sessions and verify they maintain independent state.

**Step 5: Document any issues found**

If any tests fail, create issues for fixes needed.

---

## Task 9: Final Review and Cleanup

**Files:**
- Review: All modified files

**Step 1: Review all changes**

```bash
git diff main
```

**Step 2: Ensure all scripts are executable**

```bash
ls -l plugins/ralph-loop/hooks/*.sh plugins/ralph-loop/scripts/*.sh
# All should have -rwxr-xr-x permissions
```

**Step 3: Verify no trailing whitespace or syntax issues**

```bash
# Check for trailing whitespace in shell scripts
grep -n '[[:space:]]$' plugins/ralph-loop/hooks/*.sh plugins/ralph-loop/scripts/*.sh
# Expected: No output
```

**Step 4: Final commit if any cleanup needed**

```bash
# If any cleanup was done
git add -A
git commit -m "chore: final cleanup for multi-session support"
```

**Step 5: Summarize implementation**

Create a summary of what was implemented and any known limitations.

---

## Notes

- **SessionStart hook requires CLAUDE_ENV_FILE to be available** - This is documented behavior but may have issues in some plugin installations (see Issue #11649)
- **State files are now global** - Stored in `~/.claude/ralph-loop/` instead of project-local `.claude/`
- **Each session is completely isolated** - No shared state between sessions
- **Cancel only affects current session** - Cannot cancel loops from other sessions for safety

## References

- @superpowers:executing-plans - Use this skill to implement the plan
- @superpowers:dispatching-parallel-agents - Use for executing independent tasks in parallel
- Claude Code Hooks Documentation: https://code.claude.com/docs/en/hooks
- Issue #11649: CLAUDE_ENV_FILE availability in plugin SessionStart hooks

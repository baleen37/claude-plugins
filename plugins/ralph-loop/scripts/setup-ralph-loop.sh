#!/bin/bash
# Ralph Loop Setup Script
# Creates state file for in-session Ralph loop
set -euo pipefail

# Parse arguments
PROMPT_PARTS=()
MAX_ITERATIONS=0
COMPLETION_PROMISE="null"

# Parse options and positional arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            cat << 'HELP_EOF'
Ralph Loop - Interactive self-referential development loop

USAGE:
    /ralph-loop [PROMPT...] [OPTIONS]

ARGUMENTS:
    PROMPT...       Initial prompt to start the loop (can be multiple words without quotes)

OPTIONS:
    --max-iterations <N>     Maximum iterations before auto-stop (default: unlimited)
    --completion-promise '<TEXT>'   Promise phrase (USE QUOTES for multi-word)
    -h, --help              Show this help message

DESCRIPTION:
    Starts a Ralph Loop in your CURRENT session. The stop hook prevents
    exit and feeds your output back as input until completion or iteration limit.

    To signal completion, you must output: <promise>YOUR_PHRASE</promise>

    Use this for:
    - Interactive iteration where you want to see progress
    - Tasks requiring self-correction and refinement
    - Learning how Ralph works

EXAMPLES:
    /ralph-loop Build a todo API --completion-promise 'DONE' --max-iterations 20
    /ralph-loop --max-iterations 10 Fix the auth bug
    /ralph-loop Refactor cache layer (runs forever)
    /ralph-loop --completion-promise 'TASK COMPLETE' Create a REST API

STOPPING:
    Only by reaching --max-iterations or detecting --completion-promise
    No manual stop - Ralph runs infinitely by default!

MONITORING:
    # View current iteration:
    grep '^iteration:' ~/.claude/ralph-loop/ralph-loop-\$RALPH_SESSION_ID.local.md

    # View full state:
    head -10 ~/.claude/ralph-loop/ralph-loop-\$RALPH_SESSION_ID.local.md
HELP_EOF
            exit 0
            ;;
        --max-iterations)
            if [[ -z "${2:-}" ]]; then
                echo "Error: --max-iterations requires a number argument" >&2
                echo "" >&2
                echo " Valid examples:" >&2
                echo "   --max-iterations 10" >&2
                echo "   --max-iterations 50" >&2
                echo "   --max-iterations 0 (unlimited)" >&2
                echo "" >&2
                echo " You provided: --max-iterations (with no number)" >&2
                exit 1
            fi
            if ! [[ "$2" =~ ^[0-9]+$ ]]; then
                echo "Error: --max-iterations must be a positive integer or 0, got: $2" >&2
                echo "" >&2
                echo " Valid examples:" >&2
                echo "   --max-iterations 10" >&2
                echo "   --max-iterations 50" >&2
                echo "   --max-iterations 0 (unlimited)" >&2
                echo "" >&2
                echo " Invalid: decimals (10.5), negative numbers (-5), text" >&2
                exit 1
            fi
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        --completion-promise)
            if [[ -z "${2:-}" ]]; then
                echo "Error: --completion-promise requires a text argument" >&2
                echo "" >&2
                echo " Valid examples:" >&2
                echo "   --completion-promise 'DONE'" >&2
                echo "   --completion-promise 'TASK COMPLETE'" >&2
                echo "   --completion-promise 'All tests passing'" >&2
                echo "" >&2
                echo " You provided: --completion-promise (with no text)" >&2
                echo "" >&2
                echo " Note: Multi-word promises must be quoted!" >&2
                exit 1
            fi
            COMPLETION_PROMISE="$2"
            shift 2
            ;;
        *)
            # Non-option argument - collect all as prompt parts
            PROMPT_PARTS+=("$1")
            shift
            ;;
    esac
done

# Join all prompt parts with spaces
PROMPT="${PROMPT_PARTS[*]:-}"

# Validate prompt is non-empty
if [[ -z "$PROMPT" ]]; then
    echo "Error: No prompt provided" >&2
    echo "" >&2
    echo " Ralph needs a task description to work on." >&2
    echo "" >&2
    echo " Examples:" >&2
    echo "   /ralph-loop Build a REST API for todos" >&2
    echo "   /ralph-loop Fix the auth bug --max-iterations 20" >&2
    echo "   /ralph-loop --completion-promise 'DONE' Refactor code" >&2
    echo "" >&2
    echo " For all options: /ralph-loop --help" >&2
    exit 1
fi

# Source session env file to get RALPH_SESSION_ID
SESSION_ENV_FILE="$HOME/.claude/ralph-loop/session-env.sh"
if [[ -f "$SESSION_ENV_FILE" ]]; then
    source "$SESSION_ENV_FILE"
fi

# Validate RALPH_SESSION_ID is available
if [[ -z "${RALPH_SESSION_ID:-}" ]]; then
    echo "Error: RALPH_SESSION_ID environment variable not found" >&2
    echo "" >&2
    echo " This indicates the SessionStart hook may not have run properly." >&2
    echo " Please check that hooks.json is correctly configured." >&2
    exit 1
fi

# Create state directory
STATE_DIR="$HOME/.claude/ralph-loop"
mkdir -p "$STATE_DIR"

# State file with session_id
STATE_FILE="$STATE_DIR/ralph-loop-$RALPH_SESSION_ID.local.md"

# Check for existing loop in this session
if [[ -f "$STATE_FILE" ]]; then
    echo "Warning: A Ralph loop is already active for this session" >&2
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

# Report loop started
echo "Ralph loop started (iteration 0)"
echo ""
echo "Session ID: $RALPH_SESSION_ID"
echo "State file: $STATE_FILE"
echo ""
echo "Max iterations: $MAX_ITERATIONS"
echo "Completion promise: $COMPLETION_PROMISE"
echo ""
echo "STRICT REQUIREMENTS (DO NOT VIOLATE):"
echo "  - Use <promise> XML tags EXACTLY as shown above"
echo "  - The statement MUST be completely and unequivocally TRUE"
echo "  - Do NOT output false statements to exit the loop"
echo "  - Do NOT lie even if you think you should exit"
echo ""
echo "IMPORTANT - Do not circumvent the loop:"
echo " Even if you believe you're stuck, the task is impossible,"
echo " or you've been running too long - you MUST NOT output a"
echo " false promise statement. The loop is designed to continue"
echo " until the promise is GENUINELY TRUE. Trust the process."
echo ""
echo " If the loop should stop, the promise statement will become"
echo " true naturally. Do not force it by lying."
echo "═══════════════════════════════════════════════════════════"

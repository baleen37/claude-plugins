#!/bin/bash
set -euo pipefail

# === Configuration ===
MAX_ITERATIONS="${1:-10}"
RALPH_DIR=".ralph"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_TEMPLATE="$SCRIPT_DIR/prompt.md"
PID_FILE="$RALPH_DIR/ralph.pid"
LOG_DIR="$RALPH_DIR/logs"

# === Validation ===
if [[ ! -f "$RALPH_DIR/prd.json" ]]; then
  echo "Error: $RALPH_DIR/prd.json not found. Run /ralph-init first." >&2
  exit 1
fi

if [[ ! -f "$PROMPT_TEMPLATE" ]]; then
  echo "Error: prompt template not found at $PROMPT_TEMPLATE" >&2
  exit 1
fi

# === Check for existing loop ===
if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Error: Ralph loop already running (PID $OLD_PID). Run /cancel-ralph first." >&2
    exit 1
  fi
  rm -f "$PID_FILE"
fi

# === Branch setup ===
BRANCH_NAME=$(jq -r '.branchName' "$RALPH_DIR/prd.json")
CURRENT_BRANCH=$(git branch --show-current)

if [[ "$BRANCH_NAME" != "null" ]] && [[ -n "$BRANCH_NAME" ]] && [[ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    git checkout "$BRANCH_NAME"
  else
    git checkout -b "$BRANCH_NAME"
  fi
fi

# === Initialize progress.txt if missing ===
if [[ ! -f "$RALPH_DIR/progress.txt" ]]; then
  cat > "$RALPH_DIR/progress.txt" <<EOF
# Ralph Progress Log
Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Codebase Patterns
(No patterns discovered yet)

---
EOF
fi

# === Create log directory ===
mkdir -p "$LOG_DIR"

# === Record PID ===
echo $$ > "$PID_FILE"

# === Cleanup on exit ===
cleanup() {
  rm -f "$PID_FILE"
}
trap cleanup EXIT

# === Main loop ===
echo "Ralph loop started: max $MAX_ITERATIONS iterations"
echo ""

for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo "=== Ralph iteration $i/$MAX_ITERATIONS ==="

  # Build prompt from template
  PROMPT=$(sed "s/{{ITERATION}}/$i/g; s/{{MAX}}/$MAX_ITERATIONS/g" "$PROMPT_TEMPLATE")

  # Log file for this iteration
  ITERATION_LOG="$LOG_DIR/iteration-$i.log"

  # Run fresh Claude instance using --message for better CLI compatibility
  # Output to both console and log file
  echo "Starting iteration $i at $(date)" > "$ITERATION_LOG"
  OUTPUT=$(claude --message "$PROMPT" 2>&1 | tee -a "$ITERATION_LOG") || true
  echo "Finished iteration $i at $(date)" >> "$ITERATION_LOG"

  # Check for completion promise
  if echo "$OUTPUT" | grep -q '<promise>COMPLETE</promise>'; then
    echo ""
    echo "=== Ralph completed at iteration $i ==="
    rm -f "$PID_FILE"
    exit 0
  fi

  echo ""
  echo "--- Iteration $i finished, continuing... ---"
  echo ""
done

echo "=== Ralph reached max iterations ($MAX_ITERATIONS) ==="
exit 1

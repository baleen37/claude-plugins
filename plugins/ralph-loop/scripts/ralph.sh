#!/bin/bash
set -euo pipefail

# === Configuration ===
# Validate and set max iterations
if [[ -n "${1:-}" ]]; then
  if ! [[ "$1" =~ ^[0-9]+$ ]]; then
    echo "Error: MAX_ITERATIONS must be a positive integer (got: '$1')" >&2
    exit 1
  fi
  MAX_ITERATIONS="$1"
else
  MAX_ITERATIONS=10
fi
RALPH_DIR=".ralph"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_TEMPLATE="$SCRIPT_DIR/prompt.md"
PID_FILE="$RALPH_DIR/ralph.pid"
LOG_DIR="$RALPH_DIR/logs"
LAST_BRANCH_FILE="$RALPH_DIR/.last-branch"
ARCHIVE_DIR="$RALPH_DIR/archive"

# === Validation ===
if [[ ! -f "$RALPH_DIR/prd.json" ]]; then
  echo "Error: $RALPH_DIR/prd.json not found. Run /ralph-init first." >&2
  exit 1
fi

if [[ ! -f "$PROMPT_TEMPLATE" ]]; then
  echo "Error: prompt template not found at $PROMPT_TEMPLATE" >&2
  exit 1
fi

# === Archive previous run if branch changed ===
archive_previous_run() {
  local branch_to_archive="$1"
  local archive_date
  archive_date=$(date +"%Y-%m-%d")

  # Remove 'ralph/' prefix from branch name for archive directory
  local feature_name="${branch_to_archive#ralph/}"
  local archive_path="$ARCHIVE_DIR/${archive_date}-${feature_name}"

  # If archive directory already exists, append timestamp
  if [[ -d "$archive_path" ]]; then
    local timestamp
    timestamp=$(date +"%H%M%S")
    archive_path="${archive_path}-${timestamp}"
  fi

  # Create archive directory
  mkdir -p "$archive_path"

  # Archive prd.json and progress.txt
  if [[ -f "$RALPH_DIR/prd.json" ]]; then
    cp "$RALPH_DIR/prd.json" "$archive_path/"
  fi

  if [[ -f "$RALPH_DIR/progress.txt" ]]; then
    cp "$RALPH_DIR/progress.txt" "$archive_path/"
  fi

  echo "Archived previous run (branch: $branch_to_archive) to $archive_path"
}

# Check if we need to archive previous run
BRANCH_NAME=$(jq -r '.branchName' "$RALPH_DIR/prd.json")
if [[ -f "$LAST_BRANCH_FILE" ]]; then
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE")
  if [[ "$BRANCH_NAME" != "null" ]] && [[ -n "$BRANCH_NAME" ]] && [[ "$BRANCH_NAME" != "$LAST_BRANCH" ]]; then
    archive_previous_run "$LAST_BRANCH"

    # Reset progress.txt for new run
    cat > "$RALPH_DIR/progress.txt" <<EOF
# Ralph Progress Log
Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Codebase Patterns
(No patterns discovered yet)

---
EOF
  fi
fi

# Update .last-branch with current branch
echo "$BRANCH_NAME" > "$LAST_BRANCH_FILE"

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

  # Run fresh Claude instance
  # Output to both console and log file
  echo "Starting iteration $i at $(date)" > "$ITERATION_LOG"
  OUTPUT=$(echo "$PROMPT" | claude --print --dangerously-skip-permissions 2>&1 | tee -a "$ITERATION_LOG") || true
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

  # Sleep to prevent API rate limiting
  sleep 2
done

echo "=== Ralph reached max iterations ($MAX_ITERATIONS) ==="
exit 1

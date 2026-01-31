#!/usr/bin/env bash
# shell.sh: Quick wrapper to attach to Claude Code test container
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/scripts/attach-container.sh" "$@"

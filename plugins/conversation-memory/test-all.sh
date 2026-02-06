#!/usr/bin/env bash
#
# Test runner for conversation-memory plugin
#
# Usage:
#   ./test-all.sh          # Run all tests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"
npx vitest run

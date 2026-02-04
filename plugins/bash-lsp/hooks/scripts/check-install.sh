#!/bin/bash
set -euo pipefail

# Lightweight check - exit immediately if bash-language-server exists
command -v bash-language-server &>/dev/null && exit 0

# Not installed, install in background
npm install -g bash-language-server >/dev/null 2>&1 &
exit 0

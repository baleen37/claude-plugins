#!/bin/bash
set -euo pipefail

# Auto-install LSP servers if not found

# Bash
command -v bash-language-server &>/dev/null || {
    npm install -g bash-language-server >/dev/null 2>&1 &
}

# Python (pyright)
command -v pyright &>/dev/null || {
    npm install -g pyright >/dev/null 2>&1 &
}

# TypeScript/JavaScript
command -v typescript-language-server &>/dev/null || {
    npm install -g typescript-language-server typescript >/dev/null 2>&1 &
}

# Go (gopls)
command -v gopls &>/dev/null || {
    go install golang.org/x/tools/gopls@latest >/dev/null 2>&1 &
}

# Kotlin
command -v kotlin-language-server &>/dev/null || {
    brew install kotlin-language-server >/dev/null 2>&1 &
}

# Lua
command -v lua-language-server &>/dev/null || {
    brew install lua-language-server >/dev/null 2>&1 &
}

# Nix (nil)
command -v nil &>/dev/null || {
    cargo install --git https://github.com/oxalica/nil nil >/dev/null 2>&1 &
}

exit 0

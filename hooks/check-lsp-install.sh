#!/usr/bin/env bash
# Unified LSP installation check for all language servers
# Combines checks for: bash, typescript, python, nix, go, lua, kotlin

set -euo pipefail

# Color output helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

check_and_install() {
    local name="$1"
    local command="$2"
    local install_cmd="$3"
    
    if command -v "$command" &>/dev/null; then
        echo -e "[lsp] ${GREEN}✓${NC} $name already installed"
        return 0
    fi
    
    echo -e "[lsp] ${YELLOW}Installing $name...${NC}"
    if eval "$install_cmd" &>/dev/null; then
        echo -e "[lsp] ${GREEN}✓${NC} $name installed"
        return 0
    else
        echo -e "[lsp] ${RED}✗${NC} Failed to install $name" >&2
        return 1
    fi
}

# Track overall success
failed=0

# Bash Language Server
check_and_install "bash-language-server" "bash-language-server" \
    "npm install -g bash-language-server" || ((failed++))

# TypeScript Language Server
check_and_install "typescript-language-server" "typescript-language-server" \
    "npm install -g typescript-language-server typescript" || ((failed++))

# Python (pyright)
check_and_install "pyright" "pyright" \
    "npm install -g pyright" || ((failed++))

# Nix (nil)
check_and_install "nil" "nil" \
    "cargo install --git https://github.com/oxalica/nil nil" || ((failed++))

# Go (gopls)
check_and_install "gopls" "gopls" \
    "go install golang.org/x/tools/gopls@latest" || ((failed++))

# Lua Language Server
check_and_install "lua-language-server" "lua-language-server" \
    "brew install lua-language-server" || ((failed++))

# Kotlin Language Server
check_and_install "kotlin-language-server" "kotlin-language-server" \
    "brew install kotlin-language-server" || ((failed++))

# Summary
echo ""
if [ "$failed" -eq 0 ]; then
    echo -e "[lsp] ${GREEN}All LSP servers installed and ready${NC}"
    exit 0
else
    echo -e "[lsp] ${RED}$failed LSP server(s) failed to install${NC}" >&2
    exit 1
fi

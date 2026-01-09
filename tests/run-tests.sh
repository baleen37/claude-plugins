#!/bin/bash

# 프로젝트 루트로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

FAILED=0
PASSED=0

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== Running Plugin Tests ==="
echo ""

# 테스트 결과 함수
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        ((FAILED++))
    fi
}

# 테스트 1: 필수 디렉토리 존재 확인
echo "Test: Required directories exist"
all_dirs_exist=0
for dir in ".claude-plugin" "plugins" "plugins/example-plugin" "plugins/example-plugin/.claude-plugin" "plugins/example-plugin/commands" "plugins/example-plugin/agents" "plugins/example-plugin/skills" "plugins/example-plugin/hooks"; do
    if [ ! -d "$dir" ]; then
        echo "  Missing: $dir"
        all_dirs_exist=1
    fi
done
test_result $all_dirs_exist "Required directories exist"
echo ""

# 테스트 2: plugin.json 존재 및 유효성
echo "Test: plugin.json exists and is valid JSON"
plugin_json="plugins/example-plugin/.claude-plugin/plugin.json"
plugin_json_valid=1
if [ -f "$plugin_json" ] && jq empty "$plugin_json" 2>/dev/null; then
    plugin_json_valid=0
fi
test_result $plugin_json_valid "plugin.json exists and is valid JSON"
echo ""

# 테스트 3: marketplace.json 존재 및 유효성
echo "Test: marketplace.json exists and is valid JSON"
marketplace_json=".claude-plugin/marketplace.json"
marketplace_json_valid=1
if [ -f "$marketplace_json" ] && jq empty "$marketplace_json" 2>/dev/null; then
    marketplace_json_valid=0
fi
test_result $marketplace_json_valid "marketplace.json exists and is valid JSON"
echo ""

# 테스트 4: plugin.json 필수 필드
echo "Test: plugin.json has required fields"
plugin_fields_valid=0
if [ -f "$plugin_json" ]; then
    for field in name description version author; do
        if ! jq -e ".$field" "$plugin_json" >/dev/null 2>&1; then
            echo "  Missing: $field"
            plugin_fields_valid=1
        fi
    done
    name=$(jq -r .name "$plugin_json" 2>/dev/null)
    if ! [[ "$name" =~ ^[a-z0-9-]+$ ]]; then
        echo "  Invalid name format"
        plugin_fields_valid=1
    fi
else
    plugin_fields_valid=1
fi
test_result $plugin_fields_valid "plugin.json has required fields"
echo ""

# 테스트 5: marketplace.json 필수 필드
echo "Test: marketplace.json has required fields"
marketplace_fields_valid=0
if [ -f "$marketplace_json" ]; then
    if ! jq -e ".name" "$marketplace_json" >/dev/null 2>&1; then
        echo "  Missing: name"
        marketplace_fields_valid=1
    fi
    if ! jq -e ".owner.name" "$marketplace_json" >/dev/null 2>&1; then
        echo "  Missing: owner.name"
        marketplace_fields_valid=1
    fi
    if ! jq -e ".plugins" "$marketplace_json" >/dev/null 2>&1; then
        echo "  Missing: plugins"
        marketplace_fields_valid=1
    fi
else
    marketplace_fields_valid=1
fi
test_result $marketplace_fields_valid "marketplace.json has required fields"
echo ""

# 테스트 6: SKILL.md 파일 frontmatter
echo "Test: SKILL.md files have valid frontmatter"
skill_frontmatter_valid=0
while IFS= read -r -d '' file; do
    content=$(cat "$file")
    if [[ ! "$content" =~ ^---$'\n' ]]; then
        echo "  No delimiter: $file"
        skill_frontmatter_valid=1
    fi
    if [[ ! "$content" =~ name: ]]; then
        echo "  Missing name: $file"
        skill_frontmatter_valid=1
    fi
    if [[ ! "$content" =~ description: ]]; then
        echo "  Missing description: $file"
        skill_frontmatter_valid=1
    fi
done < <(find . -name "SKILL.md" -type f -print0 2>/dev/null)
test_result $skill_frontmatter_valid "SKILL.md files have valid frontmatter"
echo ""

# 테스트 7: Command 파일 frontmatter
echo "Test: Command files have frontmatter delimiters"
command_frontmatter_valid=0
while IFS= read -r -d '' file; do
    content=$(cat "$file")
    if [[ ! "$content" =~ ^---$'\n' ]]; then
        echo "  No delimiter: $file"
        command_frontmatter_valid=1
    fi
done < <(find plugins -path "*/commands/*.md" -type f -print0 2>/dev/null)
test_result $command_frontmatter_valid "Command files have frontmatter delimiters"
echo ""

# 테스트 8: Agent 파일 frontmatter
echo "Test: Agent files have frontmatter delimiters"
agent_frontmatter_valid=0
while IFS= read -r -d '' file; do
    content=$(cat "$file")
    if [[ ! "$content" =~ ^---$'\n' ]]; then
        echo "  No delimiter: $file"
        agent_frontmatter_valid=1
    fi
done < <(find plugins -path "*/agents/*.md" -type f -print0 2>/dev/null)
test_result $agent_frontmatter_valid "Agent files have frontmatter delimiters"
echo ""

# 결과 요약
echo "=== Test Summary ==="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi

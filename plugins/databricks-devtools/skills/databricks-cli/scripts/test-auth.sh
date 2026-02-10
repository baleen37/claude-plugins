#!/usr/bin/env bash
# Databricks CLI Authentication Test Script
# Tests authentication and connection to Databricks workspace

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Profile to test (default: default, or use DATABRICKS_PROFILE env var)
PROFILE="${DATABRICKS_PROFILE:-default}"

echo "Testing Databricks CLI Authentication"
echo "====================================="
echo "Profile: $PROFILE"
echo ""

# Function to print test result
print_result() {
    local test_name="$1"
    local result="$2"
    local message="${3:-}"

    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "  $message"
        fi
    elif [ "$result" = "WARN" ]; then
        echo -e "${YELLOW}⚠ WARN${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "  $message"
        fi
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "  $message"
        fi
    fi
}

# Test 1: Check if databricks CLI is installed
echo "Test 1: Checking if Databricks CLI is installed..."
if command -v databricks &> /dev/null; then
    VERSION=$(databricks --version 2>&1 || echo "unknown")
    print_result "Databricks CLI installed" "PASS" "Version: $VERSION"
else
    print_result "Databricks CLI installed" "FAIL" "databricks command not found"
    echo ""
    echo "Install Databricks CLI:"
    echo "  brew install databricks  # macOS"
    echo "  pip install databricks-cli  # Python"
    exit 1
fi
echo ""

# Test 2: Check if configuration file exists
echo "Test 2: Checking configuration file..."
if [ -f "$HOME/.databrickscfg" ]; then
    print_result "Configuration file exists" "PASS" "$HOME/.databrickscfg"
else
    print_result "Configuration file exists" "FAIL" "$HOME/.databrickscfg not found"
    echo ""
    echo "Create configuration file at ~/.databrickscfg:"
    echo ""
    echo "[default]"
    echo "host = https://your-workspace.cloud.databricks.com"
    echo "token = dapi..."
    exit 1
fi
echo ""

# Test 3: Check if profile exists in config
echo "Test 3: Checking if profile '$PROFILE' exists..."
if grep -q "^\[$PROFILE\]" "$HOME/.databrickscfg" 2>/dev/null; then
    print_result "Profile '$PROFILE' exists" "PASS"
else
    print_result "Profile '$PROFILE' exists" "FAIL" "Profile not found in ~/.databrickscfg"
    echo ""
    echo "Available profiles:"
    grep -E "^\[.*\]" "$HOME/.databrickscfg" || echo "  No profiles found"
    exit 1
fi
echo ""

# Test 4: Test workspace connection
echo "Test 4: Testing workspace connection..."
if WORKSPACE_LIST=$(databricks --profile "$PROFILE" workspace list / 2>&1); then
    print_result "Workspace connection" "PASS" "Successfully connected to workspace"
    echo ""
    echo "Workspace root contents:"
    echo "$WORKSPACE_LIST" | head -10
    if [ "$(echo "$WORKSPACE_LIST" | wc -l)" -gt 10 ]; then
        echo "  ... (truncated)"
    fi
else
    print_result "Workspace connection" "FAIL" "Cannot connect to workspace"
    echo ""
    echo "Error output:"
    echo "$WORKSPACE_LIST"
    echo ""
    echo "Common issues:"
    echo "  1. Invalid or expired token - regenerate PAT in workspace UI"
    echo "  2. Incorrect host URL - verify workspace URL"
    echo "  3. Network/firewall issues - check connectivity"
    exit 1
fi
echo ""

# Test 5: Get current user info
echo "Test 5: Getting current user information..."
if USER_INFO=$(databricks --profile "$PROFILE" current-user me --output json 2>&1); then
    USERNAME=$(echo "$USER_INFO" | jq -r '.userName // .email // empty' 2>/dev/null || echo "unknown")
    print_result "Current user info" "PASS" "Authenticated as: $USERNAME"
else
    print_result "Current user info" "FAIL" "Could not retrieve user information"
fi
echo ""

# Test 6: List clusters (optional, may fail due to permissions)
echo "Test 6: Testing cluster access..."
if CLUSTER_LIST=$(databricks --profile "$PROFILE" clusters list --output json 2>&1); then
    CLUSTER_COUNT=$(echo "$CLUSTER_LIST" | jq 'length' 2>/dev/null || echo "0")
    RUNNING_COUNT=$(echo "$CLUSTER_LIST" | jq '[.[] | select(.state == "RUNNING")] | length' 2>/dev/null || echo "0")
    print_result "Cluster access" "PASS" "$CLUSTER_COUNT total clusters, $RUNNING_COUNT running"
else
    print_result "Cluster access" "WARN" "No cluster permissions or error occurred"
fi
echo ""

# Test 7: List warehouses (optional)
echo "Test 7: Testing SQL warehouse access..."
if WAREHOUSE_LIST=$(databricks --profile "$PROFILE" warehouses list --output json 2>&1); then
    WAREHOUSE_COUNT=$(echo "$WAREHOUSE_LIST" | jq 'length' 2>/dev/null || echo "0")
    print_result "SQL warehouse access" "PASS" "$WAREHOUSE_COUNT warehouses available"
else
    print_result "SQL warehouse access" "WARN" "No warehouse permissions or error occurred"
fi
echo ""

# Summary
echo "====================================="
echo "Authentication Test Summary"
echo "====================================="
echo -e "${GREEN}All critical tests passed!${NC}"
echo ""
echo "Your Databricks CLI is properly configured for profile '$PROFILE'."
echo ""
echo "Next steps:"
echo "  - List workspace: databricks workspace list /"
echo "  - List clusters:  databricks clusters list"
echo "  - Run SQL query:  databricks sql execute --warehouse-id ID 'SELECT 1'"

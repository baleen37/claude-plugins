#!/usr/bin/env bats
# Test: update-all-plugins.sh script

load helpers/bats_helper

SCRIPT_PATH="${PROJECT_ROOT}/plugins/auto-updater/scripts/update-all-plugins.sh"

@test "update-all-plugins.sh exists and is executable" {
    [ -f "$SCRIPT_PATH" ]
    [ -x "$SCRIPT_PATH" ]
}

@test "update-all-plugins.sh handles set -e with arithmetic operations" {
    # The script should complete without error even when using ((count++))
    # under set -euo pipefail

    # Create mock binaries in a temporary directory
    local mock_bin="${BATS_TMPDIR}/mock-bin-$$.d"
    mkdir -p "$mock_bin"

    # Mock curl to return valid marketplace JSON
    # Handle -o option to write JSON to file
    cat > "$mock_bin/curl" << 'EOF'
#!/usr/bin/env bash
# Find -o option and get output file
args=("$@")
for i in "${!args[@]}"; do
    if [[ "${args[$i]}" == "-o" ]]; then
        output_file="${args[$((i+1))]}"
        break
    fi
done

# Write marketplace JSON to output file
cat > "$output_file" << 'JSON'
{
  "name": "test-marketplace",
  "description": "Test marketplace",
  "plugins": [
    {
      "name": "test-plugin-1",
      "description": "Test plugin 1"
    },
    {
      "name": "test-plugin-2",
      "description": "Test plugin 2"
    }
  ]
}
JSON
exit 0
EOF
    chmod +x "$mock_bin/curl"

    # Mock claude command to succeed
    cat > "$mock_bin/claude" << 'EOF'
#!/usr/bin/env bash
echo "Installing $*"
exit 0
EOF
    chmod +x "$mock_bin/claude"

    # Run script with mock binaries in PATH
    PATH="$mock_bin:$PATH" run "$SCRIPT_PATH"

    # Script should complete successfully (exit 0)
    [ "$status" -eq 0 ]

    # Should mention installing plugins
    [[ "$output" == *"Installing/updating"* ]]

    # Should have summary
    [[ "$output" == *"Summary"* ]]

    # Should show successful installation count
    [[ "$output" == *"Successfully installed/updated: 2 plugins"* ]]

    # Clean up
    rm -rf "$mock_bin"
}

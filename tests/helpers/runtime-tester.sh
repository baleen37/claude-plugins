#!/usr/bin/env bash
# Runtime-specific test execution helpers

run_bun_tests() {
  local plugin_dir="$1"
  cd "$plugin_dir" || return 1

  if [ -f "package.json" ]; then
    if jq -e '.scripts.test' package.json >/dev/null; then
      bun test
    else
      echo "No test script found in package.json"
      return 1
    fi
  else
    echo "No package.json found for bun runtime plugin"
    return 1
  fi
}

run_bash_tests() {
  local test_dir="$1"
  bats "$test_dir"
}

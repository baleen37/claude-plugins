# Testing Guide

This project uses BATS (Bash Automated Testing System) for testing plugin structure, configuration, and components.

## Running Tests

### All Tests (Root + Plugins)

```bash
bash tests/run-all-tests.sh
```

This script runs:
1. Root tests in `tests/`
2. All plugin tests in `plugins/*/tests/`

### Root Tests Only

```bash
bats tests/
```

### Individual Test Files

```bash
bats tests/directory_structure.bats
bats tests/marketplace_json.bats
bats tests/plugin_json.bats
bats tests/command_files.bats
bats tests/agent_files.bats
bats tests/skill_files.bats
```

### Individual Plugin Tests

```bash
bats plugins/git-guard/tests/
bats plugins/me/tests/
bats plugins/ralph-loop/tests/
bats plugins/strategic-compact/tests/
bats plugins/auto-updater/tests/
```

### Verbose Output

```bash
bats --verbose tests/
bats --print-output-on-failure tests/
```

## Test Files

### directory_structure.bats

Validates the overall plugin structure:
- Required directories exist (`.claude-plugin/`, `plugins/`, `tests/`)
- Each plugin has required subdirectories
- Marketplace configuration exists

### marketplace_json.bats

Validates `.claude-plugin/marketplace.json`:
- File exists and is valid JSON
- Contains required `marketplace` object
- Contains `plugins` array
- Each plugin entry has required fields

### plugin_json.bats

Validates individual `.claude-plugin/plugin.json` files:
- File exists for each plugin
- Valid JSON format
- Required fields present (`name`, `description`, `version`)
- Valid component arrays (commands, agents, skills, hooks)

### command_files.bats

Validates command markdown files:
- Files exist for registered commands
- Valid YAML frontmatter
- Required frontmatter fields (`description`)
- Markdown content exists

### agent_files.bats

Validates agent markdown files:
- Files exist for registered agents
- Valid YAML frontmatter
- Required frontmatter fields (`name`, `description`)
- Markdown content exists

### skill_files.bats

Validates skill markdown files:
- Files exist for registered skills
- Valid YAML frontmatter
- Required frontmatter fields (`name`, `description`)
- SKILL.md naming convention

## Test Helpers

Tests use `tests/bats_helper.bash` which provides:
- `get_plugins_list()`: Returns list of all plugins
- `get_plugin_json()`: Gets plugin.json content for a plugin
- `get_marketplace_json()`: Gets marketplace.json content
- `check_yaml_frontmatter()`: Validates YAML frontmatter in markdown files

## CI/CD

Tests run automatically on:
- Pull requests
- Push to main branch
- Releases

See `.github/workflows/` for workflow definitions.

## Pre-commit Hooks

Pre-commit hooks run additional checks:
- YAML validation
- JSON validation
- ShellCheck (shell script linting)
- markdownlint (Markdown linting)

Run pre-commit manually:

```bash
pre-commit run --all-files
```

## Writing New Tests

When adding a new component type or validation:

1. Create a new `.bats` file in `tests/`
2. Source the helper: `load bats_helper.bash`
3. Write test functions using BATS syntax:

```bash
#!/usr/bin/env bats

load bats_helper.bash

@test "example test" {
    # Arrange
    result="$(some_function)"

    # Assert
    [ "$result" == "expected" ]
}
```

4. Run the new test to verify it works
5. Update this documentation if needed

## Troubleshooting

### Tests Fail Locally But Pass in CI

- Ensure you're running tests from the repository root
- Check that BATS is installed: `bats --version`
- Try running with verbose output: `bats --verbose tests/`

### YAML Frontmatter Errors

- Ensure proper YAML syntax in frontmatter
- Use `|` or `>` for multi-line values
- Escape special characters properly

### Path Issues

- Use absolute paths in tests
- Use `${CLAUDE_PLUGIN_ROOT}` for portability
- Don't hardcode repository paths

## Plugin Testing

### Directory Structure

All plugins should follow this test structure:

```
plugins/{plugin-name}/
├── tests/                    # Required: Test files directory
│   ├── {plugin-name}.bats   # Main plugin test file
│   ├── fixtures/            # Optional: Test fixtures
│   └── helpers/             # Optional: Plugin-specific helpers
└── .claude-plugin/
    └── plugin.json
```

### Using Shared Helpers

Plugin tests can load the root bats_helper:

```bash
#!/usr/bin/env bats
# From plugins/{name}/tests/{name}.bats
load ../../../../tests/helpers/bats_helper

@test "example plugin test" {
    [ -d "${PLUGIN_ROOT}" ]
}
```

### Plugin Test Example

```bash
#!/usr/bin/env bats

load ../../../../tests/helpers/bats_helper

PLUGIN_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"

@test "plugin directory exists" {
    [ -d "${PLUGIN_ROOT}" ]
}

@test "plugin.json exists" {
    [ -f "${PLUGIN_ROOT}/.claude-plugin/plugin.json" ]
}

@test "plugin.json is valid JSON" {
    cat "${PLUGIN_ROOT}/.claude-plugin/plugin.json" | jq . >/dev/null
}
```

### Test Naming Conventions

- Main test file: `{plugin-name}.bats`
- Helper tests: `{feature}-helper.bats`
- Component tests: `{component}-test.bats`


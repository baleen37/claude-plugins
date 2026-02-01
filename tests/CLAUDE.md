<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# tests

## Purpose
BATS (Bash Automated Testing System) test suite for validating plugin structure, functionality, and CI/CD workflows.

## Key Files

| File | Description |
|------|-------------|
| `run-all-tests.sh` | Script to run all tests with proper output |
| `helpers/` | Test helper functions and fixtures |
| `directory_structure.bats` | Validates directory structure requirements |
| `marketplace_json.bats` | Tests marketplace.json schema compliance |
| `plugin_json.bats` | Tests individual plugin.json files |
| `command_files.bats` | Validates command file structure |
| `agent_files.bats` | Validates agent file structure |
| `skill_files.bats` | Validates skill file structure |
| `hooks_json.bats` | Tests hooks.json schema compliance |
| `github_workflows.bats` | Validates GitHub workflow files |
| `git-guard-hooks.bats` | Tests git-guard hook functionality |
| `databricks_plugin.bats` | Databricks plugin specific tests |
| `jira_plugin.bats` | Jira plugin specific tests |
| `memory-persistence.bats` | Memory-persistence plugin tests |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `helpers/` | Reusable test helpers and fixtures |

## For AI Agents

### Working In This Directory
- All test files use `.bats` extension
- Run tests with `bats tests/` or `./tests/run-all-tests.sh`
- Test files should follow naming convention: `{feature}.bats`
- Use helpers for common test setup/teardown

### Testing Requirements
- Run full test suite before committing
- Each test should be independent
- Use `load helpers/common.bash` for shared utilities
- Test both success and failure cases

### Common Patterns
- `@test "description" { ... }` for test definitions
- `run` command to execute and capture output
- `[$status -eq 0]` for exit code assertions
- `[[ "$output" =~ "expected" ]]` for output assertions

## Dependencies

### External
- **BATS** - Bash Automated Testing System
- **bats-support** - Support library for BATS
- **bats-assert** - Assertion library for BATS
- **ShellCheck** - Shell script linting

### Internal
- `plugins/` - Plugins being tested
- `schemas/` - JSON schemas for validation

<!-- MANUAL: -->

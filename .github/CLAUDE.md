<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# .github

## Purpose
GitHub Actions workflows and custom composite actions for CI/CD automation.

## Key Files

| File | Description |
|------|-------------|
| `workflows/ci.yml` | Main CI workflow running BATS tests |
| `workflows/release.yml` | Automated release workflow with semantic-release |
| `workflows/test-workflows.yml` | Tests workflow actions locally |
| `actions/validate-plugin/action.yml` | Composite action for validating plugin structure |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `workflows/` | GitHub Actions workflow files |
| `actions/` | Reusable composite actions |

## For AI Agents

### Working In This Directory
- Workflow files use YAML syntax
- Follow GitHub Actions best practices
- Test workflow changes in `actions/validate-plugin/` first
- Ensure workflows are triggered on correct events (push, pull_request)

### Testing Requirements
- Use `workflows/test-workflows.yml` to test actions
- Validate YAML syntax before committing
- Test workflow changes in a feature branch

### Common Patterns
- Composite actions use `runs.using: composite` syntax
- Workflows reference actions with `./.github/actions/`
- Use `bats tests/` for running tests locally

## Dependencies

### External
- **GitHub Actions** - CI/CD platform
- **BATS** - Test framework used in workflows

### Internal
- `tests/` - Test suite directory
- `schemas/` - JSON schemas for validation

<!-- MANUAL: -->

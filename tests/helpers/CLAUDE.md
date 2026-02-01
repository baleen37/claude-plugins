<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# helpers

## Purpose
Reusable test helper functions and fixtures for BATS test suite.

## Key Files

| File | Description |
|------|-------------|
| `bats_helper.bash` | BATS-specific helper functions |
| `fixture_factory.bash` | Test fixture generation utilities |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- Load with `load helpers/common.bash`
- Provides reusable test utilities
- Fixture factory creates test data
- BATS helpers for test setup

### Testing Requirements
- Helpers are tested indirectly via test suite
- Verify fixture generation produces valid data
- Ensure helpers don't have side effects

### Common Patterns
- Functions prefix with plugin name
- Fixture factory uses consistent naming
- Export functions for test use
- Use local variables to avoid pollution

## Dependencies

### External
- **BATS** - Test framework
- **bats-support** - Support library
- **bats-assert** - Assertion library

### Internal
- `../` - Test files that use helpers
- `../../schemas/` - Schemas for fixture validation

<!-- MANUAL: -->

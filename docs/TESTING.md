# Testing Guide

## Running Tests

### All Tests

```bash
bats tests/
```

### Specific Test File

```bash
bats tests/test-plugin-structure.bats
```

### Specific Test

```bash
bats tests/test-plugin-structure.bats::test_name
```

## Test Structure

- `test-plugin-structure.bats`: Directory and file structure
- `test-json-validation.bats`: JSON schema validation
- `test-frontmatter.bats`: YAML frontmatter validation

## Writing Tests

Create new test file:

```bash
bats new tests/test-my-feature.bats
```

Example test:

```bash
@test "My feature works" {
    run bash scripts/validate-plugin.sh
    assert_success
}
```

## Validation Scripts

| Script | Purpose |
|--------|---------|
| `validate-plugin.sh` | Run all validations |
| `validate-json.sh` | Validate JSON files |
| `validate-frontmatter.py` | Validate YAML frontmatter |
| `validate-naming.sh` | Check naming conventions |
| `validate-paths.sh` | Check for hardcoded paths |

## CI/CD

Tests run automatically on:
- Pull requests
- Push to main branch
- Releases

See `.github/workflows/` for workflow definitions.

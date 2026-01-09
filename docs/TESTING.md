# Testing Guide

## Running Tests

### All Tests

```bash
bash tests/run-tests.sh
```

### All Validations

```bash
bash scripts/validate-plugin.sh
```

### Individual Validations

```bash
# Structure validation
bash scripts/validate-structure.sh

# JSON validation
bash scripts/validate-json.sh

# YAML frontmatter validation
python3 scripts/validate-frontmatter.py

# Naming conventions
bash scripts/validate-naming.sh

# Path validation
bash scripts/validate-paths.sh
```

## Validation Scripts

| Script | Purpose |
|--------|---------|
| `validate-plugin.sh` | Run all validations |
| `validate-structure.sh` | Validate plugin structure and required files |
| `validate-json.sh` | Validate JSON files and required fields |
| `validate-frontmatter.py` | Validate YAML frontmatter |
| `validate-naming.sh` | Check naming conventions |
| `validate-paths.sh` | Check for hardcoded paths |

## CI/CD

Validations run automatically on:
- Pull requests
- Push to main branch
- Releases

See `.github/workflows/` for workflow definitions.

# @baleen/bats-helpers

Shared BATS (Bash Automated Testing System) test helpers for Baleen Claude Plugins.

## Installation

```bash
npm install --save-dev @baleen/bats-helpers
```

## Usage

In your BATS test file:

```bash
load @baleen/bats-helpers/bats_helper
```

## Available Helpers

### Path Setup

- `PROJECT_ROOT` - Automatically set to the plugin project root

### Test Lifecycle

- `setup()` - Creates temp directory for test files (exported as `TEST_TEMP_DIR`)
- `teardown()` - Cleans up temp directory

### JSON Validation

- `validate_json(file)` - Validates JSON file syntax
- `ensure_jq()` - Skips test if jq is not available

### Frontmatter Helpers

- `has_frontmatter_delimiter(file)` - Checks if file has YAML frontmatter delimiter (`---`)
- `has_frontmatter_field(file, field)` - Checks if frontmatter field exists

## Example

```bash
#!/usr/bin/env bats

load @baleen/bats-helpers/bats_helper

PLUGIN_DIR="${PROJECT_ROOT}/plugins/my-plugin"

@test "plugin has valid manifest" {
    local manifest="${PLUGIN_DIR}/.claude-plugin/plugin.json"
    [ -f "$manifest" ]
    validate_json "$manifest"
}
```

## License

MIT

<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# schemas

## Purpose
JSON schemas for validating plugin configuration files, marketplace metadata, and hook definitions.

## Key Files

| File | Description |
|------|-------------|
| `plugin-schema.json` | Schema for `.claude-plugin/plugin.json` files |
| `marketplace-schema.json` | Schema for `.claude-plugin/marketplace.json` files |
| `hooks-schema.json` | Schema for `hooks/hooks.json` files |

## Subdirectories

None

## For AI Agents

### Working In This Directory
- Schemas follow JSON Schema draft conventions
- All schema files should validate against their respective targets
- Use `jq` or similar tools for schema validation
- Update schemas when adding new plugin features

### Testing Requirements
- Validate schema syntax with a JSON schema validator
- Test schema against valid and invalid examples
- Ensure pre-commit hooks catch schema violations

### Common Patterns
- `$schema` property points to the schema definition
- `required` arrays list mandatory fields
- `additionalProperties: false` to enforce strict schema
- Descriptive `description` properties for each field

## Dependencies

### External
- **JSON Schema** - Schema validation standard

### Internal
- `.claude-plugin/marketplace.json` - Validated by marketplace-schema
- `plugins/*/.claude-plugin/plugin.json` - Validated by plugin-schema
- `plugins/*/hooks/hooks.json` - Validated by hooks-schema

<!-- MANUAL: -->

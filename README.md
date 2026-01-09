# Claude Plugin Boilerplate

Standard boilerplate for creating Claude Code plugins with testing, CI/CD, and validation utilities.

## Features

- Standard Structure: Follows anthropics/claude-plugins-official patterns
- Validation Scripts: JSON, YAML, naming, and path validation
- Structure Validation: Plugin structure and component verification
- CI/CD: GitHub Actions workflows for PR validation and releases
- Pre-commit Hooks: Automated quality checks
- Example Plugin: Demonstrates all component types

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/jito/claude-plugin-boilerplate.git
cd claude-plugin-boilerplate

# Install as a marketplace
/plugin marketplace add .
/plugin install example-plugin@claude-plugin-boilerplate
```

### Creating Your Own Plugin

1. Copy the example plugin:
```bash
cp -r plugins/example-plugin plugins/my-plugin
```

2. Update `plugins/my-plugin/.claude-plugin/plugin.json`
3. Add your commands, agents, skills, or hooks
4. Update `plugins/my-plugin/README.md`
5. Add to `.claude-plugin/marketplace.json`

### Running Validation

```bash
# Run tests
bash tests/run-tests.sh

# Validate all plugins
bash scripts/validate-plugin.sh

# Run pre-commit hooks manually
pre-commit run --all-files
```

## Project Structure

```
claude-plugin-boilerplate/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace configuration
├── plugins/
│   └── example-plugin/           # Example plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── commands/
│       ├── agents/
│       ├── skills/
│       └── hooks/
├── .github/workflows/            # CI/CD workflows
├── scripts/                      # Validation scripts
├── tests/                        # Test scripts
└── schemas/                      # JSON schemas
```

## Component Types

### Commands (`commands/*.md`)
User-invoked slash commands with argument handling.

### Agents (`agents/*.md`)
Autonomous specialist agents with specific tools.

### Skills (`skills/*/SKILL.md`)
Context-aware guidance that auto-activates.

### Hooks (`hooks/hooks.json`)
Event-driven automation scripts.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed development guidelines.

## Testing

See [docs/TESTING.md](docs/TESTING.md) for testing documentation.

## License

MIT License - see [LICENSE](LICENSE) file.

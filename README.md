# Baleen Claude Plugins

Claude Code plugin collection by baleen, featuring useful tools for AI-assisted development.

## Available Plugins

### Ralph Loop
Implementation of the Ralph Wiggum technique for iterative, self-referential AI development loops in Claude Code.

- **Description**: Continuous self-referential AI loops for interactive iterative development
- **Commands**: `/ralph-loop`, `/cancel-ralph`, `/help`
- **Use Case**: Well-defined tasks requiring iteration and refinement

### Example Plugin
Demonstration plugin showing all component types for creating your own plugins.

## Quick Start

### Installation from GitHub

```bash
# Add this repository as a marketplace
claude plugin marketplace add https://github.com/baleen37/claude-plugins

# Install a plugin
claude plugin install ralph-loop@baleen-plugins
```

### Using Ralph Loop

```bash
# Start Claude Code with ralph-loop
claude

# In Claude Code, start a loop
/ralph-loop "Build a REST API for todos with tests" --max-iterations 20 --completion-promise "COMPLETE"

# Cancel if needed
/cancel-ralph
```

## Project Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace configuration (baleen-plugins)
├── plugins/
│   ├── ralph-loop/               # Ralph Wiggum iterative development
│   │   ├── commands/             # Slash commands
│   │   ├── hooks/                # SessionStart, Stop hooks
│   │   └── scripts/              # Setup and cancel scripts
│   └── example-plugin/           # Plugin template
│       ├── commands/
│       ├── agents/
│       ├── skills/
│       └── hooks/
├── .github/workflows/            # CI/CD workflows
├── scripts/                      # Validation scripts
└── tests/                        # Test scripts
```

## Development

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

## Ralph Loop Philosophy

Ralph embodies several key principles:

1. **Iteration > Perfection**: Don't aim for perfect on first try. Let the loop refine the work.
2. **Failures Are Data**: "Deterministically bad" means failures are predictable and informative.
3. **Operator Skill Matters**: Success depends on writing good prompts, not just having a good model.
4. **Persistence Wins**: Keep trying until success.

## License

MIT License - see [LICENSE](LICENSE) file.

# Baleen Claude Plugins

Claude Code plugin collection by baleen, featuring useful tools for AI-assisted development.

## Available Plugins

### Ralph Loop
Implementation of the Ralph Wiggum technique for iterative, self-referential AI development loops in Claude Code.

- **Description**: Continuous self-referential AI loops for interactive iterative development
- **Commands**: `/ralph-loop`, `/cancel-ralph`, `/help`
- **Use Case**: Well-defined tasks requiring iteration and refinement

### Git Guard
Git workflow protection hooks that prevent commit and PR bypasses.

- **Description**: Prevents `--no-verify` commit bypass and enforces pre-commit checks
- **Commands**: `/install-git-guard`, `/uninstall-git-guard`
- **Use Case**: Teams requiring strict git workflow compliance

### My Workflow
Personal Claude Code configuration for development workflow automation.

- **Description**: TDD, systematic debugging, git workflow, code review, and development automation
- **Use Case**: Personal development environment setup

## Quick Start

### Installation from GitHub

```bash
# Add this repository as a marketplace
claude plugin marketplace add https://github.com/baleen37/claude-plugins

# Install a plugin
claude plugin install ralph-loop@baleen-plugins
claude plugin install git-guard@baleen-plugins
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

### Using Git Guard

```bash
# Install Git Guard in current repository
/install-git-guard

# Uninstall Git Guard
/uninstall-git-guard
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
│   │   ├── scripts/              # Setup and cancel scripts
│   │   └── tests/                # BATS tests
│   ├── git-guard/                # Git workflow protection
│   │   ├── commands/             # Slash commands
│   │   ├── hooks/                # Git hooks (pre-commit, pre-push)
│   │   └── tests/                # BATS tests
│   └── me/                       # Personal workflow automation
│       ├── commands/             # Slash commands
│       ├── agents/               # Autonomous agents
│       ├── skills/               # Context-aware skills
│       ├── hooks/                # Session hooks
│       └── tests/                # BATS tests
├── .github/workflows/            # CI/CD workflows
├── docs/                         # Development and testing documentation
├── tests/                        # BATS tests
├── schemas/                      # JSON schemas
└── CLAUDE.md                     # Project instructions for Claude Code
```

## Development

### Creating Your Own Plugin

1. Reference existing plugins (e.g., `git-guard`) for structure:

2. Create plugin directories:
```bash
mkdir -p plugins/my-plugin/.claude-plugin
mkdir -p plugins/my-plugin/commands
mkdir -p plugins/my-plugin/hooks
```

3. Create `plugins/my-plugin/.claude-plugin/plugin.json`
4. Add your commands, agents, skills, or hooks
5. Update `plugins/my-plugin/README.md`
6. Add to `.claude-plugin/marketplace.json`

### Running Tests

```bash
# Run all BATS tests
bats tests/

# Run specific test file
bats tests/directory_structure.bats

# Run pre-commit hooks manually
pre-commit run --all-files
```

## Ralph Loop Philosophy

Ralph embodies several key principles:

1. **Iteration > Perfection**: Don't aim for perfect on first try. Let the loop refine the work.
2. **Failures Are Data**: "Deterministically bad" means failures are predictable and informative.
3. **Operator Skill Matters**: Success depends on writing good prompts, not just having a good model.
4. **Persistence Wins**: Keep trying until success.

## Testing

This project uses automated releases via semantic-release. All commits to main trigger CI tests and release automation.

## License

MIT License - see [LICENSE](LICENSE) file.

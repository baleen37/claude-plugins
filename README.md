# Everything Agent

AI coding assistant toolkit - Claude Code, OpenCode, and more.

This is the **canonical plugin** that provides a unified toolkit for AI-assisted development.

## Available Plugins

Plugins are automatically discovered from the `plugins/` directory. For detailed
information about each plugin, see the respective plugin's README.md file.

- **git-guard**: Git workflow protection hooks that prevent commit and PR
  bypasses (automatic, no commands needed)
- **jira**: Jira integration with 5 powerful skills - triage bugs, capture
  tasks from meeting notes, generate status reports, search company knowledge,
  and convert specs to backlogs. Uses Atlassian's MCP server with OAuth 2.1.
- **databricks-devtools**: Databricks development tools with CLI commands,
  workspace sync, and run management
- **handoff**: Handoff workflow for seamless task transitions between agents
- **lsp-bash**: Language Server Protocol integration for Bash
- **lsp-go**: Language Server Protocol integration for Go
- **lsp-kotlin**: Language Server Protocol integration for Kotlin
- **lsp-lua**: Language Server Protocol integration for Lua
- **lsp-nix**: Language Server Protocol integration for Nix
- **lsp-python**: Language Server Protocol integration for Python
- **lsp-typescript**: Language Server Protocol integration for TypeScript

## Quick Start

### Installation from GitHub

```bash
# Add this repository as a marketplace
claude plugin marketplace add https://github.com/baleen37/everything-agent

# Install a plugin
claude plugin install git-guard@everything-agent
claude plugin install jira@everything-agent
```

### Using Git Guard

Git Guard operates automatically via PreToolUse hooks - no commands needed:

- `git commit --no-verify` is automatically blocked
- Pre-commit validation is enforced
- Works transparently in the background

## Project Structure

This project uses a **hybrid structure** with both a root plugin (everything-agent)
and individual plugins in the `plugins/` directory.

```text
everything-agent/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace configuration (everything-agent)
├── plugins/                      # Individual plugins (auto-discovered)
│   ├── git-guard/               # Git workflow protection
│   │   ├── hooks/                # PreToolUse hook
│   │   └── tests/                # BATS tests
│   ├── jira/                    # Jira integration
│   │   └── agents/               # Jira MCP agents
│   ├── databricks-devtools/     # Databricks development tools
│   ├── handoff/                 # Task handoff workflow
│   └── lsp-*/                   # Language Server Protocol integrations
├── .github/workflows/            # CI/CD workflows
├── docs/                         # Development and testing documentation
├── tests/                        # BATS tests (root + plugin tests)
├── schemas/                      # JSON schemas
└── CLAUDE.md                     # Project instructions for Claude Code
```

## Development

### Creating Your Own Plugin

1. Reference existing plugins (e.g., `git-guard`) for structure
2. Create plugin directories:

```bash
mkdir -p plugins/my-plugin/.claude-plugin
mkdir -p plugins/my-plugin/commands
mkdir -p plugins/my-plugin/hooks
```

1. Create `plugins/my-plugin/.claude-plugin/plugin.json`
2. Add your commands, agents, skills, or hooks
3. Update `plugins/my-plugin/README.md`
4. Add to `.claude-plugin/marketplace.json`

### Running Tests

```bash
# Run all BATS tests
bats tests/

# Run specific test file
bats tests/directory_structure.bats

# Run pre-commit hooks manually
pre-commit run --all-files
```

### Version Management & Release

This project uses **semantic-release** with **Conventional Commits** for
automated version management.

#### Commit Message Format (Conventional Commits)

```bash
# Interactive commit (recommended)
bun run commit

# Or write manually
git commit -m "type(scope): description"
```

**Types:**

- `feat`: New feature (minor version bump)
- `fix`: Bug fix (patch version bump)
- `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`: No version bump

**Scope:** Plugin name (`git-guard`, `jira`, `databricks-devtools`, etc.)

**Examples:**

```text
feat(git-guard): add new pre-commit validation
fix(jira): fix OAuth authentication flow
docs(databricks-devtools): update CLI documentation
```

#### Release Process

1. Push commits to main branch
2. GitHub Actions runs tests then semantic-release
3. Version is determined (feat → minor, fix → patch)
4. Each `plugin.json` and `marketplace.json` is updated
5. Git tag is created and GitHub release is published

### Jira MCP Server Setup

The Jira plugin requires MCP server configuration:

1. Install the Atlassian MCP server
2. Configure OAuth 2.1 authentication
3. Add MCP server configuration to Claude Code settings

See `plugins/jira/README.md` for detailed setup instructions.

### Component Types

- **Commands** (`commands/*.md`): Slash commands invoked by users (e.g., `/brainstorm`)
- **Agents** (`agents/*.md`): Autonomous experts that execute specific tasks
- **Skills** (`skills/*/SKILL.md`): Context-aware guides that activate automatically
- **Hooks** (`hooks/hooks.json` + `hooks/*.sh`): Event-driven automation (SessionStart, PreToolUse, etc.)

## Pre-commit Hooks

This project uses pre-commit hooks for code quality:

```bash
# Run pre-commit manually
pre-commit run --all-files
```

**Validations:**

- YAML syntax validation
- JSON schema validation
- ShellCheck (shell script linting)
- markdownlint (Markdown linting)
- commitlint (commit message format)

> Note: Pre-commit failures cannot be bypassed with `--no-verify` (enforced by git-guard).

## Contributing

Contributions are welcome! This project follows:

1. **Conventional Commits** - Use `bun run commit` for interactive commit creation
2. **Pre-commit Hooks** - All hooks must pass before committing
3. **Test Coverage** - Add BATS tests for new features
4. **Documentation** - Update README.md for plugin changes

## License

MIT License - see [LICENSE](LICENSE) file.

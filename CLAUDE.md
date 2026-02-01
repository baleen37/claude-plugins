<!-- Generated: 2026-02-01 | Updated: 2026-02-01 -->

# claude-plugins

## Purpose
Baleen Claude Plugins - Claude Code용 플러그인 모음입니다. AI 보조 개발을 위한 도구들을 제공하며, 반복적 자기 참조 AI 개발 루프(Ralph Loop), Git 워크플로우 보호, 개인용 개발 워크플로우 자동화 등의 기능을 포함합니다.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Project dependencies and scripts (commitizen, husky, semantic-release) |
| `.releaserc.js` | Semantic-release configuration with automatic plugin discovery |
| `CLAUDE.md` | Project guidance for Claude Code (architecture, commands, guidelines) |
| `README.md` | Project overview and documentation |
| `flake.nix` | Nix flake for reproducible development environment |
| `.pre-commit-config.yaml` | Pre-commit hooks configuration (YAML, JSON, ShellCheck, markdownlint, commitlint) |
| `.commitlintrc.js` | Commitlint configuration for Conventional Commits |
| `.gitignore` | Git ignore patterns |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `plugins/` | Plugin collection (see `plugins/AGENTS.md`) |
| `.github/` | GitHub Actions workflows and custom actions (see `.github/AGENTS.md`) |
| `tests/` | BATS test suites (see `tests/AGENTS.md`) |
| `schemas/` | JSON schemas for validation (see `schemas/AGENTS.md`) |
| `docs/` | Development and testing documentation (see `docs/AGENTS.md`) |
| `skills/` | Standalone skills (see `skills/AGENTS.md`) |
| `.claude-plugin/` | Marketplace configuration |
| `.husky/` | Git hooks managed by husky |
| `.omc/` | oh-my-claudecode state (sessions, scientist reports, checkpoints) |
| `.worktrees/` | Git worktrees for parallel development |
| `.reports/` | Analysis reports (e.g., dead code analysis) |
| `.claude/` | Claude Code session data |

## For AI Agents

### Working In This Directory
- Always run `npm install` after modifying package.json
- Use Conventional Commits format: `type(scope): description`
- Use `npm run commit` for interactive commit creation
- Never bypass pre-commit hooks with `--no-verify` (blocked by git-guard)
- Follow semantic-release workflow for version management

### Testing Requirements
- Run `bats tests/` before committing
- Ensure all pre-commit hooks pass: `pre-commit run --all-files`
- Test each plugin's functionality after modifications

### Common Patterns
- Plugin discovery: Check for `.claude-plugin/plugin.json` in subdirectories
- Version synchronization: `.releaserc.js` automatically updates all plugin.json and marketplace.json
- Portable paths: Use `${CLAUDE_PLUGIN_ROOT}` in hook scripts
- Hook script requirements: `set -euo pipefail`, jq for JSON parsing, stderr for errors

## Dependencies

### External
- **Node.js** - Runtime environment
- **semantic-release** - Automated version management
- **commitizen/commitlint** - Conventional Commits enforcement
- **husky** - Git hooks management
- **pre-commit** - Pre-commit hooks framework (Python-based)
- **BATS** - Bash Automated Testing System
- **Nix** (optional) - Reproducible development environment

### Development Tools
- **jq** - JSON parsing in shell scripts
- **ShellCheck** - Shell script linting
- **markdownlint** - Markdown linting
- **YAML linting** - YAML validation

<!-- MANUAL: Project-specific notes below this line are preserved -->

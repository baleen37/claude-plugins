# Me

Personal Claude Code configuration - TDD, systematic debugging, git workflow, code review, and development automation.

## Components

### Commands (13)
- **clean-worktree**: Clean up git worktrees
- **commit-push-pr**: Commit, push, and create/update pull requests
- **create-command**: Create new Claude Code commands
- **create-hook**: Create new hook commands
- **create-skill**: Create new skills with TDD workflow
- **debug**: Systematic debugging process
- **fix-ci**: CI troubleshooting workflow
- **git-exclude**: Manage .git/info/exclude
- **handoff**: Create detailed handoff plans
- **make-local-issues**: Review code and create GitHub issues
- **pickup**: Resume work from handoff sessions
- **research**: Web research with citations
- **sdd**: Subagent-driven development approach

### Agents
- **code-reviewer**: Review code against plans and standards

### Skills (7)
- **ci-troubleshooting**: Systematic CI debugging approach
- **commit-push-pull-request**: Complete git workflow (commit → push → PR)
- **nix-direnv-setup**: Direnv integration for Nix flakes
- **setup-precommit-and-ci**: Pre-commit hooks and CI setup
- **using-git-worktrees**: Isolated feature work with worktrees
- **web-browser**: Browser automation via Playwright/CDP
- **writing-claude-commands**: Command creation workflow

### Hooks
- **auto-install-plugins**: Automatically installs all plugins from the baleen-plugins marketplace on session start
- **git-command-validator**: Prevents --no-verify and hook bypasses in git commands

## Installation

```bash
/plugin marketplace add /path/to/claude-plugins
/plugin install me@claude-plugins
```

## Usage

This plugin provides a comprehensive set of tools for:
- Git workflow automation (commit, PR, worktree management)
- CI/CD troubleshooting and debugging
- Nix flakes development environment setup
- Code review and quality assurance
- Handoff between sessions

## Philosophy

Following strict TDD and systematic debugging practices. All features and bugfixes follow test-driven development, and root cause analysis is mandatory for any issue resolution.

## Repository

Part of the [dotfiles](https://github.com/baleen37/dotfiles) project - Nix flakes-based reproducible development environments for macOS and NixOS.

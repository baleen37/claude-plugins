---
name: commit
description: Use when user asks to create a git commit - stages files and creates a commit based on git status, diff, and recent commits
---

# Commit

## Overview

Create a git commit based on current changes.

**Core principle:** Stage and commit using a single message. No other tools or text output.

**Announce at start:** "I'm using the commit skill to create a git commit."

## Context Gathering

Before creating the commit, gather the following context:

```bash
# Current git status
git status

# Current git diff (staged and unstaged changes)
git diff HEAD

# Current branch
git branch --show-current

# Recent commits (for message style reference)
git log --oneline -10
```

## Your Task

Based on the above changes, create a single git commit.

**You have the capability to call multiple tools in a single response. Stage and create the commit using a single message.**

**Do not use any other tools or do anything else. Do not send any other text or messages besides these tool calls.**

## Allowed Tools

- `Bash(git add:*)` - Stage files
- `Bash(git status:*)` - Check git status
- `Bash(git commit:*)` - Create commit

## Important Notes

- Review the changes to create an appropriate commit message
- Follow the project's commit message style (check recent commits for patterns)
- Stage specific files - avoid `git add -A` unless intentional
- Include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` in commit message
- Always use `git status` before staging to ensure correct files are selected

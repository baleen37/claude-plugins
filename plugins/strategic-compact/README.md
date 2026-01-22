# Strategic Compact

Strategic context compaction suggestions for long Claude Code sessions.

## Overview

Strategic Compact provides non-intrusive suggestions for manual context compaction at logical intervals during long Claude Code sessions. Unlike automatic compaction which can occur at arbitrary moments, strategic compacting preserves context through logical phases of work.

## Why Manual Over Auto-Compact?

Automatic compaction happens at unpredictable points, often mid-task, which can cause:
- Loss of critical context during active work
- Interruption of thought processes
- Difficulty resuming work after compaction

Strategic compacting offers control:
- Compact after exploration, before execution
- Compact after completing milestones, before starting next
- Preserve context through logical phases
- Choose natural breakpoints in your workflow

## How It Works

The hook tracks Edit/Write tool calls per session and suggests compaction:
- First suggestion at 50 tool calls (configurable via `COMPACT_THRESHOLD`)
- Subsequent suggestions every 25 calls thereafter
- Non-blocking stderr messages don't interrupt workflows

## Usage

Install via the baleen-plugins marketplace:

```bash
/plugin install strategic-compact@baleen-plugins
```

## Configuration

Set a custom threshold via environment variable:

```bash
export COMPACT_THRESHOLD=100
```

Default: 50 tool calls

## Messages

When thresholds are reached, you'll see non-intrusive suggestions:

```
[StrategicCompact] 50 tool calls reached - consider /compact if transitioning phases
[StrategicCompact] 75 tool calls - good checkpoint for /compact if context is stale
```

## Use Cases

Ideal for:
- Long debugging sessions (compact after finding root cause)
- Multi-phase features (compact after exploration, before implementation)
- Refactoring work (compact after each module)
- Research-to-code transitions (compact before writing code)

## Repository

Part of the [dotfiles](https://github.com/baleen37/dotfiles) project - Nix flakes-based reproducible development environments for macOS and NixOS.

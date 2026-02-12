# Scripts Directory

Build, wrapper, and migration scripts for the conversation-memory plugin.

## Overview

This directory contains scripts for:

- Building the plugin with esbuild
- Wrapping executables with dependency checking
- Migrating from v2 to v3 database schema

## Files

### build.mjs

Main build script using esbuild to bundle the CLI and MCP server into standalone files.

**Usage:**

```bash
npm run build
# or directly:
node scripts/build.mjs
```

**Output:**

- `dist/cli-internal.mjs` - Bundled CLI (actual implementation)
- `dist/cli.mjs` - Graceful wrapper (copied from `src/cli-graceful.mjs`)
- `dist/mcp-server.mjs` - Bundled MCP server
- `dist/mcp-wrapper.mjs` - MCP wrapper (copied from `scripts/mcp-server-wrapper.mjs`)
- `dist/lib/check-dependencies.mjs` - Shared dependency logic

**External Dependencies (not bundled):**

The following packages are marked as external and must be installed separately:

- `@huggingface/transformers` - Embedding model
- `better-sqlite3` - SQLite database with native bindings
- `sharp` - Image processing
- `onnxruntime-node` - ONNX runtime for ML models
- `sqlite-vec` - Vector similarity search

### mcp-server-wrapper.mjs

Cross-platform wrapper script for the MCP server that ensures dependencies are installed and the build is up-to-date before starting.

**Usage:**

```bash
# Typically invoked via Claude Code MCP configuration:
node scripts/mcp-server-wrapper.mjs
```

**Behavior:**

1. Checks if `node_modules` exists
2. If missing, runs `npm install` with progress output
3. Checks if `dist/mcp-server.mjs` exists or is outdated
4. If needed, runs `npm run build`
5. Spawns the actual MCP server (`dist/mcp-server.mjs`)
6. Forwards signals (SIGTERM, SIGINT) to child process
7. Exits with same exit code as child

**Error Handling:**

- Provides helpful error messages for common issues:
  - Permission denied -> Suggests `chown` command
  - Disk space full -> Suggests freeing space
  - Network errors -> Suggests checking connection

### lib/check-dependencies.mjs

Shared dependency checking logic used by both CLI and MCP wrappers.

**Exports:**

```javascript
// Check if dependencies are installed
checkDependencies() -> { installed: boolean, missing: string[] }

// Check if build is needed
checkBuildNeeded() -> { needsBuild: boolean, reason: string }

// Install dependencies (returns Promise)
installDependencies(silent: boolean) -> Promise<void>

// Run build (returns Promise)
runBuild() -> Promise<void>

// Analyze npm error and suggest fix
analyzeError(error: Error) -> { cause: string, fix: string }
```

**Usage Example:**

```javascript
import { checkDependencies, installDependencies } from './lib/check-dependencies.mjs';

const { installed, missing } = checkDependencies();
if (!installed) {
  await installDependencies(false); // with output
}
```

### migrate-v2-to-v3.mjs

Interactive migration helper for upgrading from v2 to v3 database schema.

**Usage:**

```bash
node scripts/migrate-v2-to-v3.mjs
```

**What it does:**

1. Detects if a v2 database exists
2. Validates schema structure (v2 vs v3 tables)
3. Displays database statistics (exchange count, summary count)
4. Provides step-by-step manual migration instructions

**What it does NOT do:**

- Automatically migrate data (schema changes are too significant)
- Preserve v2 data in v3 format

**Schema Differences:**

| V2 Schema (deprecated) | V3 Schema (current) |
| ---------------------- | ------------------- |
| `exchanges` table | `observations` table |
| `vec_exchanges` table | `vec_observations` table |
| `session_summaries` table | `pending_events` table |

---

## Two-Layer Wrapper Pattern

The plugin uses a two-layer wrapper pattern for both CLI and MCP server to ensure dependencies are always available without blocking execution.

### Layer 1: Graceful Wrapper

The outer layer that handles missing dependencies gracefully.

**CLI Wrapper (`src/cli-graceful.mjs` -> `dist/cli.mjs`):**

```
User runs: cli.mjs (graceful wrapper)
    |
    v
Check dependencies
    |
    +-- Not installed --> Trigger background npm install
    |
    v
Import cli-internal.mjs (actual CLI)
    |
    +-- MODULE_NOT_FOUND --> Show helpful error, exit 1
    |
    v
CLI runs normally
```

**Key difference from MCP:** CLI triggers background install and continues. This prevents blocking the user while still ensuring dependencies will be ready for the next run.

### Layer 2: Blocking Wrapper

The inner layer used by MCP server that blocks until ready.

**MCP Wrapper (`scripts/mcp-server-wrapper.mjs` -> `dist/mcp-wrapper.mjs`):**

```
Claude Code starts MCP server
    |
    v
mcp-wrapper.mjs (blocking wrapper)
    |
    v
Check dependencies
    |
    +-- Not installed --> Run npm install (blocking, with progress)
    |
    v
Check if build needed
    |
    +-- Outdated/missing --> Run npm run build (blocking)
    |
    v
Spawn mcp-server.mjs (actual MCP server)
    |
    v
Forward signals, exit with child's code
```

**Key difference from CLI:** MCP wrapper blocks until ready because the MCP server must be functional before Claude Code can use it.

### Why Two Patterns?

| Aspect | CLI Wrapper | MCP Wrapper |
| ------ | ----------- | ----------- |
| Blocking | Non-blocking | Blocking |
| Install | Background | Foreground with progress |
| Build check | None | Checks if rebuild needed |
| Error handling | Show error, exit | Detailed error analysis |
| Use case | User commands | Claude Code integration |

**CLI** needs to be responsive. Users typing commands expect immediate feedback even if deps are missing.

**MCP** must be fully functional. Claude Code expects the MCP server to work correctly on first call.

### Benefits of the Wrapper Pattern

1. **Zero-Config First Run**: Plugin works immediately after clone without manual `npm install`
2. **Auto-Rebuild**: MCP wrapper detects when rebuild is needed (e.g., after `git pull`)
3. **Cross-Platform**: Works on Windows, macOS, and Linux
4. **Helpful Errors**: Translates npm errors into actionable suggestions
5. **Graceful Degradation**: CLI continues even with missing deps (shows helpful message)

### Implementation Notes

**Environment Variable:**

Both wrappers respect `CLAUDE_PLUGIN_ROOT` environment variable for finding the plugin root directory. This allows the wrappers to work when copied to `dist/` for cached plugins.

```javascript
const ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');
```

**Signal Forwarding:**

The MCP wrapper forwards termination signals to the child process:

```javascript
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
```

This ensures clean shutdown when Claude Code terminates.

**Error Analysis:**

The `analyzeError()` function translates common npm errors:

| Error Code | Cause | Suggested Fix |
| ---------- | ----- | ------------- |
| EACCES | Permission denied | `sudo chown -R $(whoami) ~/.npm` |
| ENOSPC | Disk space full | Free up disk space |
| ETIMEDOUT | Network error | Check internet connection |
| ECONNRESET | Network error | Check internet connection |

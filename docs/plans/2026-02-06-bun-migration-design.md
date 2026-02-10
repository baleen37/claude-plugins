# Bun Migration Design

**Date:** 2026-02-06
**Author:** jito & Bot
**Status:** Design

## Overview

Migrate the entire claude-plugins monorepo from Node.js/npm to Bun runtime and package manager.

## Motivation

- Faster install times and runtime performance
- Simplified toolchain (single tool for runtime, package manager, bundler, test runner)
- Built-in TypeScript support
- Smaller dependency footprint

## Architecture Changes

### Before
- Runtime: Node.js 20
- Package Manager: npm
- Lockfile: package-lock.json
- Test Runner: vitest
- Bundler: esbuild (databricks-devtools)
- TypeScript: tsc

### After
- Runtime: Bun >=1.0.0
- Package Manager: bun pm
- Lockfile: bun.lockb
- Test Runner: bun test (native)
- Bundler: bun build (native)
- TypeScript: bun (native)

## Component Changes

### Root Package

**package.json changes:**
- Add `engines.bun": ">=1.0.0"`
- Remove vitest, @vitest/ui, tsx from devDependencies
- scripts remain the same (Bun-compatible)

**File changes:**
- Delete: `.nvmrc`
- Delete: `package-lock.json`
- Delete: `vitest.config.ts`
- Add: `.bun-version` (with version `1.1.38` or `latest`)

### Plugins

#### databricks-devtools
- `scripts.build`: `"node scripts/build.mjs"` → `"bun scripts/build.mjs"`
- `scripts.test`: `"vitest run"` → `"bun test"`
- Remove: vitest, esbuild from devDependencies
- Delete: `vitest.config.ts` (if exists)

#### suggest-compacting
- `scripts.build`: `"tsc"` → `"bun build src/*.ts --outdir dist --target bun"`
- `scripts.prepare`: `"npm run build"` → `"bun run build"`
- Remove: tsx, typescript from devDependencies

#### BATS plugins (git-guard, ralph-loop, me, auto-updater)
- No changes needed (BATS is runtime-agnostic)

#### conversation-memory
- Already migrated (no changes)

### CI/CD

**GitHub Actions:**
- Replace `actions/setup-node@v3` with `oven-sh/setup-bun-action@v1`
- Update version syntax for Bun

**Nix flake:**
- Replace Node.js package with Bun
- Or remove if simplifying

### Git Hooks

**Husky:**
- `.husky/pre-commit`: No change (pre-commit is Python-based)
- `.husky/commit-msg`: No change (commitlint works with Bun)

## Build & Test Flows

### Dependency Installation
```bash
bun install
```

### Building
```bash
# databricks-devtools
bun scripts/build.mjs

# suggest-compacting
bun build src/*.ts --outdir dist --target bun

# conversation-memory
bun scripts/build.mjs
```

### Testing
```bash
# Root unit tests
bun test

# BATS integration tests
bun run test:bats

# Individual plugins
cd plugins/databricks-devtools && bun test
```

## Error Handling & Compatibility

### Known Compatibility
- `better-sqlite3`: Supported by Bun
- `@modelcontextprotocol/sdk`: Pure JS, compatible
- `@huggingface/transformers`: WASM-based, compatible
- `semantic-release`: Works with Bun
- `commitlint`: Works with Bun

### Rollback Plan
If issues arise:
1. Delete `bun.lockb`
2. Restore `package-lock.json` from git
3. Revert `package.json` changes (bun → node)
4. Revert CI/CD changes

## Testing Checklist

- [ ] `bun install` succeeds
- [ ] All plugins build successfully
- [ ] `bun test` passes
- [ ] `bun run test:bats` passes
- [ ] Git hooks work (pre-commit, commit-msg)
- [ ] CI/CD workflows pass
- [ ] semantic-release dry-run works

## Migration Steps

1. Update root package.json
2. Update each plugin's package.json
3. Update CI/CD workflows
4. Update Nix flake (if applicable)
5. Delete obsolete files (.nvmrc, package-lock.json, vitest.config.ts)
6. Create .bun-version
7. Run `bun install`
8. Build and test all plugins
9. Commit changes

## Files Changed

### Deleted
- package-lock.json
- .nvmrc
- vitest.config.ts (root)
- plugins/databricks-devtools/vitest.config.ts (if exists)

### Created
- bun.lockb (auto-generated)
- .bun-version

### Modified
- package.json (root)
- plugins/databricks-devtools/package.json
- plugins/suggest-compacting/package.json
- .github/workflows/*.yml
- flake.nix (if using Nix)

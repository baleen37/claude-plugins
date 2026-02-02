#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { PreToolUseInput } from '../types/index.js';

// Color codes for output
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m'; // No Color

function logInfo(message: string): void {
  console.error(`${GREEN}[INFO]${NC} ${message}`);
}

function logWarn(message: string): void {
  console.error(`${YELLOW}[WARN]${NC} ${message}`);
}

function logError(message: string): void {
  console.error(`${RED}[ERROR]${NC} ${message}`);
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkPrecommitInstalled(): boolean {
  if (!commandExists('pre-commit')) {
    logWarn("pre-commit is not installed");
    logInfo("Install it with: pip install pre-commit");
    return false;
  }
  return true;
}

function checkPrecommitConfig(): boolean {
  if (!existsSync('.pre-commit-config.yaml')) {
    logWarn("No .pre-commit-config.yaml found in current directory");
    return false;
  }
  return true;
}

async function runPrecommitChecks(stagedOnly: boolean): Promise<number> {
  if (!checkPrecommitInstalled()) {
    return 0; // Don't block if pre-commit is not installed
  }

  if (!checkPrecommitConfig()) {
    return 0; // Don't block if no config
  }

  logInfo("Running pre-commit checks...");

  try {
    if (stagedOnly) {
      const files = execSync('git diff --name-only --cached', { encoding: 'utf-8' }).trim();
      if (files) {
        execSync(`pre-commit run --files ${files}`, { stdio: 'inherit' });
      }
    } else {
      execSync('pre-commit run --all-files', { stdio: 'inherit' });
    }
  } catch (error) {
    logError("Pre-commit checks failed");
    logInfo("Fix the issues and try again, or run: pre-commit run --all-files");
    return 2;
  }

  logInfo("Pre-commit checks passed");
  return 0;
}

function extractCommandFromJson(jsonInput: string): string {
  try {
    const parsed = JSON.parse(jsonInput) as PreToolUseInput;
    return parsed.command || '';
  } catch {
    return '';
  }
}

export { checkPrecommitInstalled, checkPrecommitConfig };

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Read JSON from stdin (PreToolUse standard)
    const input = await readStdin();
    const command = extractCommandFromJson(input);

    if (command) {
      // Trigger pre-commit checks before git commit
      if (/git\s+commit/.test(command)) {
        const exitCode = await runPrecommitChecks(true);
        process.exit(exitCode);
      }

      // For git push, check all files
      if (/git\s+push/.test(command)) {
        const exitCode = await runPrecommitChecks(false);
        process.exit(exitCode);
      }

      process.exit(0);
    } else {
      // Direct execution (e.g., from SessionStart hook)
      const exitCode = await runPrecommitChecks(false);
      process.exit(exitCode);
    }
  } else {
    const arg = args[0];
    if (arg === '--check' || arg === '-c') {
      const exitCode = await runPrecommitChecks(false);
      process.exit(exitCode);
    } else if (arg === '--staged' || arg === '-s') {
      const exitCode = await runPrecommitChecks(true);
      process.exit(exitCode);
    } else {
      console.error("Usage: $0 [--check|--staged]");
      process.exit(1);
    }
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

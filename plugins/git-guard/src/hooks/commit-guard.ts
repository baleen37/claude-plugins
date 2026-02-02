#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { PreToolUseInput } from '../types/index.js';

// Color codes for output
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const NC = '\x1b[0m'; // No Color

function logInfo(message: string): void {
  console.error(`${GREEN}[INFO]${NC} ${message}`);
}

function logError(message: string): void {
  console.error(`${RED}[ERROR]${NC} ${message}`);
}

function blockCommand(errorMsg: string, infoMsg = ''): number {
  logError(errorMsg);
  if (infoMsg) {
    logInfo(infoMsg);
  }
  return 2;
}

function matchesPattern(command: string, pattern: RegExp): boolean {
  return pattern.test(command);
}

function validateGitCommand(command: string): number {
  // Quick exit: if not a git command, allow immediately
  if (!matchesPattern(command, /^\s*(\S*=\S*\s+)*git\s+/)) {
    return 0;
  }

  // Check for --no-verify in git commit commands
  if (matchesPattern(command, /git\s+commit.*--no-verify/)) {
    return blockCommand(
      "--no-verify is not allowed in this repository",
      "Please use 'git commit' without --no-verify. All commits must pass quality checks."
    );
  }

  // Check for other common bypass patterns
  if (matchesPattern(command, /git\s+.*skip.*hooks/)) {
    return blockCommand("Skipping hooks is not allowed");
  }

  if (matchesPattern(command, /git\s+.*--no-.*hook/)) {
    return blockCommand("Hook bypass is not allowed");
  }

  // Check for environment variable bypasses
  if (matchesPattern(command, /HUSKY=0.*git/)) {
    return blockCommand("HUSKY=0 bypass is not allowed");
  }

  if (matchesPattern(command, /SKIP_HOOKS=.*git/)) {
    return blockCommand("SKIP_HOOKS bypass is not allowed");
  }

  // Check for dangerous git commands that can bypass hooks
  if (matchesPattern(command, /git\s+update-ref/)) {
    return blockCommand(
      "git update-ref is not allowed in this repository",
      "This command can bypass commit hooks."
    );
  }

  if (matchesPattern(command, /git\s+filter-branch/)) {
    return blockCommand(
      "git filter-branch is not allowed in this repository",
      "This command can rewrite history and bypass hooks."
    );
  }

  // Check for hooksPath modification (security risk)
  if (matchesPattern(command, /git\s+config.*core\.hooksPath/)) {
    return blockCommand(
      "Modifying core.hooksPath is not allowed in this repository",
      "This can disable commit hooks."
    );
  }

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

export { validateGitCommand, extractCommandFromJson };

async function main(): Promise<void> {
  const input = await readStdin();

  // Extract command from JSON
  const command = extractCommandFromJson(input);

  // Validate the command if we got one
  if (command) {
    const exitCode = validateGitCommand(command);
    process.exit(exitCode);
  } else {
    // No command found, allow execution
    process.exit(0);
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

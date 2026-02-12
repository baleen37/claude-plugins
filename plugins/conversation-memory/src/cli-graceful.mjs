#!/usr/bin/env node
/**
 * Graceful CLI wrapper - checks dependencies before running actual CLI.
 * Prevents ERR_MODULE_NOT_FOUND errors on first run by silently skipping
 * and triggering background npm install.
 */

import { checkDependencies, installDependencies } from '../scripts/lib/check-dependencies.mjs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, 'cli-internal.mjs');

async function main() {
  const { installed, missing } = checkDependencies();

  if (!installed) {
    // Install in background, don't block CLI
    installDependencies(true).catch(() => {
      // Silent failure - CLI might still work with partial deps
    });
  }

  // Run CLI regardless
  try {
    await import(CLI_PATH);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('Error: Missing dependencies. Installing now...');
      console.error('Please run: npm install');
      if (missing.length > 0) {
        console.error(`Missing: ${missing.join(', ')}`);
      }
      process.exit(1);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('CLI failed:', error.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Graceful CLI wrapper - checks dependencies before running actual CLI.
 * Prevents ERR_MODULE_NOT_FOUND errors on first run by silently skipping
 * and triggering background npm install.
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, '..');
const nodeModules = join(pluginRoot, 'node_modules');

if (!existsSync(nodeModules)) {
  // Start npm install in background, silent
  spawn('npm', ['install', '--silent', '--no-audit', '--no-fund'], {
    cwd: pluginRoot,
    detached: true,
    stdio: 'ignore',
    shell: true
  }).unref();
  // Silent exit - will work on next run
  process.exit(0);
}

// Import actual CLI
await import('./cli-internal.mjs');

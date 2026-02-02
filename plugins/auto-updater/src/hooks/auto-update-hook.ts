#!/usr/bin/env npx tsx

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const CONFIG_DIR = path.join(process.env.HOME || '', '.claude', 'auto-updater');
const TIMESTAMP_FILE = path.join(CONFIG_DIR, 'last-check');
const CHECK_INTERVAL = 3600; // 1 hour in seconds

async function main(): Promise<void> {
  // Create config dir if needed
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  // Check if we need to run
  const shouldRun = await shouldRunCheck();

  if (shouldRun) {
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const updateScript = path.join(scriptDir, '..', '..', 'scripts', 'update.ts');

    // Run update script silently
    await runScript(updateScript, [], { silent: true });
  }
}

async function shouldRunCheck(): Promise<boolean> {
  try {
    await fs.access(TIMESTAMP_FILE);
    const content = await fs.readFile(TIMESTAMP_FILE, 'utf-8');
    const lastCheck = parseInt(content.trim(), 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - lastCheck;

    return timeDiff >= CHECK_INTERVAL;
  } catch {
    // File doesn't exist, should run
    return true;
  }
}

function runScript(
  scriptPath: string,
  args: string[],
  options: { silent: boolean } = {}
): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', scriptPath, ...args], {
      stdio: options.silent ? 'ignore' : 'inherit',
    });

    child.on('close', (code) => {
      if (code !== 0) {
        // Ignore errors for auto-update hook
        resolve();
      } else {
        resolve();
      }
    });

    child.on('error', () => {
      // Ignore errors for auto-update hook
      resolve();
    });
  });
}

main().catch((err) => {
  // Silently fail for auto-update hook
  process.exit(0);
});

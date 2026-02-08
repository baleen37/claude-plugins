/**
 * Observer CLI - Control the observer background process.
 *
 * Commands:
 * - observer start: Start the observer process in the background
 * - observer stop: Stop the observer process
 * - observer status: Check if the observer is running
 */

import { spawn } from 'child_process';
import path from 'path';

const command = process.argv[2] || 'status';

/**
 * Start the observer process in the background.
 */
async function startObserver(): Promise<void> {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
  const cliPath = path.join(pluginRoot, 'dist', 'cli.mjs');

  const observer = spawn('node', [cliPath, 'observer-run'], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: pluginRoot
    }
  });

  observer.unref();

  console.log('Observer process started');
}

/**
 * Stop the observer process.
 */
async function stopObserver(): Promise<void> {
  const { startObserver: stop } = await import('../core/observer.js');
  stop();
}

/**
 * Check observer status.
 */
async function checkStatus(): Promise<void> {
  const { observerStatus } = await import('../core/observer.js');
  observerStatus();
}

async function main() {
  try {
    switch (command) {
      case 'start':
        await startObserver();
        break;

      case 'stop':
        await stopObserver();
        break;

      case 'status':
        await checkStatus();
        break;

      case 'observer-run':
        // This is the internal command that actually runs the observer
        const { startObserver: run } = await import('../core/observer.js');
        await run();
        break;

      default:
        console.error(`
Observer CLI - Control the observer background process

Usage:
  observer <command>

Commands:
  start    Start the observer process in the background
  stop     Stop the observer process
  status   Check if the observer is running

Examples:
  conversation-memory observer start
  conversation-memory observer status
  conversation-memory observer stop
`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

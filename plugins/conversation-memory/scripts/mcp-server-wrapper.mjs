#!/usr/bin/env node
/**
 * Cross-platform wrapper script for MCP server that ensures dependencies are installed
 * This runs before the MCP server starts and works on Windows, macOS, and Linux
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  checkDependencies,
  checkBuildNeeded,
  installDependencies,
  runBuild,
  analyzeError
} from './lib/check-dependencies.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine plugin root directory (respect CLAUDE_PLUGIN_ROOT env var)
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || join(__dirname, '..');

async function ensureDependenciesAndBuild() {
  const { installed } = checkDependencies();

  if (!installed) {
    try {
      console.error('[conversation-memory] Installing dependencies (first run only)...');
      console.error('This may take 30-60 seconds...');
      await installDependencies(false);
      console.error('[conversation-memory] Dependencies installed successfully.');
    } catch (error) {
      const analysis = analyzeError(error);
      console.error('[conversation-memory] ERROR: Failed to install dependencies.');
      console.error(`Cause: ${analysis.cause}`);
      console.error(`Fix: ${analysis.fix}`);
      throw error;
    }
  }

  const { needsBuild, reason } = checkBuildNeeded();

  if (needsBuild) {
    try {
      console.error(`[conversation-memory] Building plugin (${reason})...`);
      await runBuild();
      console.error('[conversation-memory] Build completed successfully.');
    } catch (error) {
      const analysis = analyzeError(error);
      console.error('[conversation-memory] ERROR: Build failed.');
      console.error(`Cause: ${analysis.cause}`);
      console.error(`Fix: ${analysis.fix}`);
      throw error;
    }
  }
}

async function main() {
  try {
    await ensureDependenciesAndBuild();

    // Start the MCP server
    const mcpServerPath = join(PLUGIN_ROOT, 'dist', 'mcp-server.mjs');

    if (!existsSync(mcpServerPath)) {
      console.error(`[conversation-memory] ERROR: MCP server not found at ${mcpServerPath}`);
      console.error('Please run: npm run build');
      process.exit(1);
    }

    // Spawn the MCP server
    const child = spawn(process.execPath, [mcpServerPath], {
      stdio: 'inherit',
      shell: false
    });

    // Forward signals to the child process
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    process.on('SIGINT', () => child.kill('SIGINT'));

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code || 0);
      }
    });

    child.on('error', (err) => {
      console.error(`[conversation-memory] ERROR: Failed to start MCP server: ${err.message}`);
      process.exit(1);
    });

  } catch (error) {
    console.error(`[conversation-memory] ERROR: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[conversation-memory] Unexpected error: ${error.message}`);
  process.exit(1);
});

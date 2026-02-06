#!/usr/bin/env node
/**
 * Cross-platform wrapper script for MCP server that ensures dependencies are installed
 * This runs before the MCP server starts and works on Windows, macOS, and Linux
 */

import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine plugin root directory
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || join(__dirname, '..');

// Helper function to run npm install
function runNpmInstall() {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCommand = isWindows ? 'npm.cmd' : 'npm';

    console.error('[conversation-memory] Installing dependencies (first run only)...');
    console.error('This may take 30-60 seconds...');

    let stderrOutput = '';

    const child = spawn(npmCommand, ['install', '--silent'], {
      cwd: PLUGIN_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows
    });

    child.stdout.on('data', (data) => {
      process.stderr.write(data);
    });

    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
      process.stderr.write(data);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.error('[conversation-memory] Dependencies installed successfully.');
        resolve();
      } else {
        console.error('[conversation-memory] ERROR: Failed to install dependencies.');

        // Analyze error cause
        if (stderrOutput.includes('EACCES') || stderrOutput.includes('permission denied')) {
          console.error('Cause: Permission denied');
          console.error('Fix: sudo chown -R $(whoami) ~/.npm');
        } else if (stderrOutput.includes('ENOSPC')) {
          console.error('Cause: Disk space full');
          console.error('Fix: Free up disk space');
        } else if (/ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(stderrOutput)) {
          console.error('Cause: Network error');
          console.error('Fix: Check internet connection and retry');
        }

        console.error(`Manual fallback: cd "${PLUGIN_ROOT}" && npm install`);
        reject(new Error(`npm install failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error(`[conversation-memory] ERROR: Failed to run npm install: ${err.message}`);
      reject(err);
    });
  });
}

// Helper function to run build
function runBuild() {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCommand = isWindows ? 'npm.cmd' : 'npm';

    console.error('[conversation-memory] Building plugin...');

    let stderrOutput = '';

    const child = spawn(npmCommand, ['run', 'build', '--silent'], {
      cwd: PLUGIN_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows
    });

    child.stdout.on('data', (data) => {
      process.stderr.write(data);
    });

    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
      process.stderr.write(data);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.error('[conversation-memory] Build completed successfully.');
        resolve();
      } else {
        console.error('[conversation-memory] ERROR: Build failed.');

        // Analyze error cause
        if (stderrOutput.includes('EACCES') || stderrOutput.includes('permission denied')) {
          console.error('Cause: Permission denied');
          console.error('Fix: sudo chown -R $(whoami) ~/.npm');
        } else if (stderrOutput.includes('ENOSPC')) {
          console.error('Cause: Disk space full');
          console.error('Fix: Free up disk space');
        } else if (/ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(stderrOutput)) {
          console.error('Cause: Network error');
          console.error('Fix: Check internet connection and retry');
        }

        console.error(`Manual fallback: cd "${PLUGIN_ROOT}" && npm run build`);
        reject(new Error(`npm run build failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error(`[conversation-memory] ERROR: Failed to run build: ${err.message}`);
      reject(err);
    });
  });
}

async function ensureDependenciesAndBuild() {
  const nodeModulesPath = join(PLUGIN_ROOT, 'node_modules');
  const mcpServerPath = join(PLUGIN_ROOT, 'dist', 'mcp-server.mjs');
  const packageJsonPath = join(PLUGIN_ROOT, 'package.json');

  // Check if node_modules exists
  if (!existsSync(nodeModulesPath)) {
    await runNpmInstall();
  }

  // Check if we need to build or rebuild
  let needsBuild = false;

  if (!existsSync(mcpServerPath)) {
    needsBuild = true;
  } else if (existsSync(packageJsonPath)) {
    // Rebuild if package.json is newer than dist (version update)
    const packageJsonMtime = statSync(packageJsonPath).mtimeMs;
    const mcpServerMtime = statSync(mcpServerPath).mtimeMs;
    if (packageJsonMtime > mcpServerMtime) {
      needsBuild = true;
    }
  }

  if (needsBuild) {
    await runBuild();
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

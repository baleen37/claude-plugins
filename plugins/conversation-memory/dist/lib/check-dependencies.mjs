#!/usr/bin/env node
/**
 * Shared dependency checking logic for CLI and MCP wrappers
 * Returns: { installed: boolean, missing: string[] }
 */

import { existsSync, statSync } from 'fs';
import { spawn } from 'child_process';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '../..');

/**
 * Check if dependencies are installed
 * @returns {{ installed: boolean, missing: string[], error?: string }}
 */
export function checkDependencies() {
  const nodeModulesPath = join(ROOT, 'node_modules');

  if (!existsSync(nodeModulesPath)) {
    return { installed: false, missing: ['node_modules'] };
  }

  return { installed: true, missing: [] };
}

/**
 * Check if build is needed
 * @returns {{ needsBuild: boolean, reason: string }}
 */
export function checkBuildNeeded() {
  const mcpServerPath = join(ROOT, 'dist', 'mcp-server.mjs');
  const packageJsonPath = join(ROOT, 'package.json');

  if (!existsSync(mcpServerPath)) {
    return { needsBuild: true, reason: 'dist/mcp-server.mjs not found' };
  }

  if (existsSync(packageJsonPath)) {
    const packageJsonMtime = statSync(packageJsonPath).mtimeMs;
    const mcpServerMtime = statSync(mcpServerPath).mtimeMs;
    if (packageJsonMtime > mcpServerMtime) {
      return { needsBuild: true, reason: 'package.json newer than dist' };
    }
  }

  return { needsBuild: false, reason: '' };
}

/**
 * Install dependencies using npm
 * @param {boolean} silent - Run silently in background
 * @returns {Promise<void>}
 */
export function installDependencies(silent = false) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCommand = isWindows ? 'npm.cmd' : 'npm';

    if (!silent) {
      console.error('[conversation-memory] Installing dependencies...');
    }

    let stderrOutput = '';

    const child = spawn(npmCommand, ['install', '--silent', '--no-audit', '--no-fund'], {
      cwd: ROOT,
      stdio: silent ? 'ignore' : ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
      detached: silent
    });

    if (!silent) {
      child.stdout?.on('data', (data) => {
        process.stderr.write(data);
      });

      child.stderr?.on('data', (data) => {
        stderrOutput += data.toString();
        process.stderr.write(data);
      });
    }

    child.on('exit', (code) => {
      if (code === 0) {
        if (!silent) {
          console.error('[conversation-memory] Dependencies installed.');
        }
        resolve();
      } else {
        const error = new Error(`npm install failed with exit code ${code}`);
        error.stderr = stderrOutput;
        reject(error);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    if (silent) {
      child.unref();
    }
  });
}

/**
 * Run build using npm
 * @returns {Promise<void>}
 */
export function runBuild() {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCommand = isWindows ? 'npm.cmd' : 'npm';

    console.error('[conversation-memory] Building plugin...');

    let stderrOutput = '';

    const child = spawn(npmCommand, ['run', 'build', '--silent'], {
      cwd: ROOT,
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
        console.error('[conversation-memory] Build completed.');
        resolve();
      } else {
        const error = new Error(`npm run build failed with exit code ${code}`);
        error.stderr = stderrOutput;
        reject(error);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Analyze npm error and suggest fix
 * @param {Error} error
 * @returns {{ cause: string, fix: string }}
 */
export function analyzeError(error) {
  const stderr = error.stderr || error.message || '';

  if (stderr.includes('EACCES') || stderr.includes('permission denied')) {
    return {
      cause: 'Permission denied',
      fix: 'sudo chown -R $(whoami) ~/.npm'
    };
  }

  if (stderr.includes('ENOSPC')) {
    return {
      cause: 'Disk space full',
      fix: 'Free up disk space and retry'
    };
  }

  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(stderr)) {
    return {
      cause: 'Network error',
      fix: 'Check internet connection and retry'
    };
  }

  return {
    cause: error.message || 'Unknown error',
    fix: `Manual fallback: cd "${ROOT}" && npm install`
  };
}

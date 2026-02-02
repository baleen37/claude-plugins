#!/usr/bin/env npx tsx

import fs from 'fs/promises';
import path from 'path';
import { loadConfig, getOrgRepoForMarketplace, getPluginsForMarketplace } from '../hooks/lib/config';
import { versionLessThan } from '../hooks/lib/version-compare';
import { Config, Marketplace, InstalledPlugin } from '../types';

// ANSI color codes
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[0;33m',
  blue: '\x1b[0;34m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const CONFIG_DIR = path.join(process.env.HOME || '', '.claude', 'auto-updater');
const TIMESTAMP_FILE = path.join(CONFIG_DIR, 'last-check');

// Silent mode (suppress output)
let silentMode = false;
let checkOnly = false;

// Log functions
function logInfo(...args: unknown[]): void {
  if (!silentMode) {
    console.error(`${colors.blue}[INFO]${colors.reset}`, ...args);
  }
}

function logWarning(...args: unknown[]): void {
  if (!silentMode) {
    console.error(`${colors.yellow}[WARNING]${colors.reset}`, ...args);
  }
}

function logError(...args: unknown[]): void {
  if (!silentMode) {
    console.error(`${colors.red}[ERROR]${colors.reset}`, ...args);
  }
}

// Update last-check timestamp
async function updateLastCheckTimestamp(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const currentTime = Math.floor(Date.now() / 1000);
  await fs.writeFile(TIMESTAMP_FILE, currentTime.toString(), 'utf-8');
}

// Download marketplace.json from GitHub
async function downloadMarketplaceJson(org: string, repo: string): Promise<Marketplace | null> {
  const url = `https://raw.githubusercontent.com/${org}/${repo}/main/.claude-plugin/marketplace.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Marketplace;
  } catch {
    return null;
  }
}

// Get installed plugins using claude CLI
async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['plugin', 'list', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logError('Failed to get installed plugins');
        resolve([]);
        return;
      }

      try {
        const plugins = JSON.parse(stdout) as InstalledPlugin[];
        resolve(plugins);
      } catch {
        logError('Failed to parse plugin list');
        resolve([]);
      }
    });

    child.on('error', () => {
      logError('Failed to get installed plugins');
      resolve([]);
    });
  });
}

// Display update available with color coding
function showUpdateAvailable(pluginName: string, localVersion: string, remoteVersion: string): void {
  if (silentMode) {
    return;
  }
  console.log(`  ${colors.bold}${pluginName}${colors.reset}: ${colors.red}${localVersion}${colors.reset} → ${colors.green}${remoteVersion}${colors.reset}`);
}

// Display plugin up to date
function showUpToDate(pluginName: string, version: string): void {
  if (silentMode) {
    return;
  }
  console.log(`  ${pluginName}: ${colors.green}${version}${colors.reset} (up to date)`);
}

// Helper function for conditional output
function printOutput(...args: unknown[]): void {
  if (!silentMode) {
    console.log(...args);
  }
}

async function main(): Promise<void> {
  let updateableCount = 0;
  let upToDateCount = 0;

  // Parse command line arguments
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--silent') {
      silentMode = true;
    } else if (arg === '--check-only') {
      checkOnly = true;
    }
  }

  // Load config
  const config = await loadConfig();

  // Check if there are any marketplaces configured
  if (config.marketplaces.length === 0) {
    logWarning('No marketplaces configured in config.json');
    process.exit(0);
  }

  // Get installed plugins
  logInfo('Checking installed plugins...');
  const installedPlugins = await getInstalledPlugins();

  if (installedPlugins.length === 0) {
    logWarning('No plugins installed or failed to get plugin list');
    process.exit(0);
  }

  printOutput('');

  // Iterate through marketplaces
  for (const mp of config.marketplaces) {
    if (!mp.name) {
      logWarning('Skipping marketplace with missing name');
      continue;
    }

    // Get org/repo from marketplace name
    const orgRepo = getOrgRepoForMarketplace(mp.name);

    if (!orgRepo) {
      logWarning(`Unknown marketplace '${mp.name}', skipping...`);
      continue;
    }

    const [org, repo] = orgRepo.split('/');
    const marketplaceName = orgRepo;

    // Download marketplace.json
    logInfo(`Checking marketplace.json from ${marketplaceName}...`);

    const remoteMp = await downloadMarketplaceJson(org, repo);
    if (!remoteMp) {
      logWarning(`Failed to download marketplace.json from ${marketplaceName}, skipping...`);
      continue;
    }

    // Get plugins to check for this marketplace (by name)
    const pluginsToCheck = getPluginsForMarketplace(config, mp.name);
    const marketplacePlugins = remoteMp.plugins;
    let marketplaceUpdateable = 0;

    printOutput(`${colors.bold}${marketplaceName}${colors.reset}:`);

    // If plugins field is specified, filter by those plugins
    if (pluginsToCheck && pluginsToCheck.length > 0) {
      for (const pluginName of pluginsToCheck) {
        // Find plugin in marketplace
        const pluginData = marketplacePlugins.find((p) => p.name === pluginName);

        if (!pluginData) {
          logWarning(`  Plugin ${pluginName} not found in ${marketplaceName}`);
          continue;
        }

        // Get versions
        const remoteVersion = pluginData.version;
        const localPlugin = installedPlugins.find((p) => p.name === pluginName);

        if (!localPlugin) {
          logWarning(`  Plugin ${pluginName} is not installed`);
          continue;
        }

        const localVersion = localPlugin.version;

        // Compare versions
        if (versionLessThan(localVersion, remoteVersion)) {
          showUpdateAvailable(pluginName, localVersion, remoteVersion);
          updateableCount++;
          marketplaceUpdateable++;
        } else {
          showUpToDate(pluginName, localVersion);
          upToDateCount++;
        }
      }
    } else {
      // No specific plugins, check all installed plugins from this marketplace
      for (const installedPlugin of installedPlugins) {
        const pluginName = installedPlugin.name;

        // Find plugin in marketplace
        const pluginData = marketplacePlugins.find((p) => p.name === pluginName);

        if (!pluginData) {
          continue;
        }

        // Get versions
        const remoteVersion = pluginData.version;
        const localVersion = installedPlugin.version;

        // Compare versions
        if (versionLessThan(localVersion, remoteVersion)) {
          showUpdateAvailable(pluginName, localVersion, remoteVersion);
          updateableCount++;
          marketplaceUpdateable++;
        } else {
          showUpToDate(pluginName, localVersion);
          upToDateCount++;
        }
      }
    }

    // Summary for this marketplace
    if (marketplaceUpdateable === 0) {
      printOutput(`  ${colors.green}✓${colors.reset} All plugins up to date`);
    } else {
      printOutput(`  ${colors.yellow}${marketplaceUpdateable} update(s) available${colors.reset}`);
    }

    printOutput('');
  }

  // Final summary
  printOutput(`${colors.bold}Summary:${colors.reset}`);
  printOutput(`  ${colors.green}${upToDateCount} up to date${colors.reset}`);
  printOutput(`  ${colors.yellow}${updateableCount} update(s) available${colors.reset}`);

  if (updateableCount > 0) {
    printOutput('');
    printOutput(`Run ${colors.bold}update-all-plugins${colors.reset} to install updates`);
  }

  // Update last-check timestamp
  if (!checkOnly) {
    await updateLastCheckTimestamp();
  }
}

import { spawn } from 'child_process';

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

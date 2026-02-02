#!/usr/bin/env npx tsx

import { spawn } from 'child_process';
import { loadConfig, getOrgRepoForMarketplace, getPluginsForMarketplace } from '../hooks/lib/config';
import { versionLessThan } from '../hooks/lib/version-compare';
import { Config, Marketplace, InstalledPlugin } from '../types';

// ANSI color codes
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[0;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m',
};

// Log functions
function logInfo(...args: unknown[]): void {
  console.error(`${colors.blue}[INFO]${colors.reset}`, ...args);
}

function logSuccess(...args: unknown[]): void {
  console.error(`${colors.green}[SUCCESS]${colors.reset}`, ...args);
}

function logWarning(...args: unknown[]): void {
  console.error(`${colors.yellow}[WARNING]${colors.reset}`, ...args);
}

function logError(...args: unknown[]): void {
  console.error(`${colors.red}[ERROR]${colors.reset}`, ...args);
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

// Install a plugin using claude CLI
async function installPlugin(pluginPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['plugin', 'install', pluginPath], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

async function main(): Promise<void> {
  let updatedCount = 0;

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
    logInfo(`Downloading marketplace.json from ${marketplaceName}...`);

    const remoteMp = await downloadMarketplaceJson(org, repo);
    if (!remoteMp) {
      logWarning(`Failed to download marketplace.json from ${marketplaceName}, skipping...`);
      continue;
    }

    // Get plugins to check for this marketplace (by name)
    const pluginsToCheck = getPluginsForMarketplace(config, mp.name);
    const marketplacePlugins = remoteMp.plugins;

    // If plugins field is specified, filter by those plugins
    if (pluginsToCheck && pluginsToCheck.length > 0) {
      logInfo(`Checking specific plugins for ${marketplaceName}...`);

      for (const pluginName of pluginsToCheck) {
        // Find plugin in marketplace
        const pluginData = marketplacePlugins.find((p) => p.name === pluginName);

        if (!pluginData) {
          logWarning(`Plugin ${pluginName} not found in ${marketplaceName}`);
          continue;
        }

        // Get versions
        const remoteVersion = pluginData.version;
        const localPlugin = installedPlugins.find((p) => p.name === pluginName);

        if (!localPlugin) {
          logInfo(`Plugin ${pluginName} is not installed`);
          continue;
        }

        const localVersion = localPlugin.version;

        // Compare versions
        if (versionLessThan(localVersion, remoteVersion)) {
          logInfo(`Updating ${pluginName}: ${localVersion} -> ${remoteVersion}`);

          if (await installPlugin(`${org}/${repo}/${pluginName}`)) {
            logSuccess(`Updated ${pluginName} to ${remoteVersion}`);
            updatedCount++;
          } else {
            logError(`Failed to update ${pluginName}`);
          }
        } else {
          logInfo(`${pluginName} is up to date (${localVersion})`);
        }
      }
    } else {
      // No specific plugins, check all installed plugins from this marketplace
      logInfo(`Checking all plugins from ${marketplaceName}...`);

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
          logInfo(`Updating ${pluginName}: ${localVersion} -> ${remoteVersion}`);

          if (await installPlugin(`${org}/${repo}/${pluginName}`)) {
            logSuccess(`Updated ${pluginName} to ${remoteVersion}`);
            updatedCount++;
          } else {
            logError(`Failed to update ${pluginName}`);
          }
        }
      }
    }
  }

  if (updatedCount === 0) {
    logSuccess('All plugins are up to date');
  } else {
    logSuccess(`Updated ${updatedCount} plugin(s)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

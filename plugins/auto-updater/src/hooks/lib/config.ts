import fs from 'fs/promises';
import path from 'path';
import { Config } from '../../types';

const DEFAULT_CONFIG: Config = {
  marketplaces: [{ name: 'baleen-plugins' }],
};

// Get config file path
function getConfigPath(): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) {
    throw new Error('CLAUDE_PLUGIN_ROOT environment variable is not set');
  }
  return path.join(pluginRoot, 'config.json');
}

// Load config from file or return default
export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  try {
    await fs.access(configPath);
  } catch {
    // File doesn't exist, return default
    return DEFAULT_CONFIG;
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as Config;
    return config;
  } catch {
    // Failed to parse, warn and return default
    console.error(`Warning: Failed to parse ${configPath}, using default config`);
    return DEFAULT_CONFIG;
  }
}

// Get org/repo for a marketplace by name
export function getOrgRepoForMarketplace(marketplaceName: string): string {
  switch (marketplaceName) {
    case 'baleen-plugins':
      return 'baleen37/claude-plugins';
    default:
      // Unknown marketplace
      return '';
  }
}

// Get plugins list for a marketplace from config
export function getPluginsForMarketplace(
  config: Config,
  marketplaceName: string
): string[] | undefined {
  const marketplace = config.marketplaces.find((mp) => mp.name === marketplaceName);
  return marketplace?.plugins;
}

// Get marketplace ID from org/repo (reverse of getOrgRepoForMarketplace)
export function getMarketplaceFromOrgRepo(orgRepo: string): string {
  switch (orgRepo) {
    case 'baleen37/claude-plugins':
      return 'baleen-plugins';
    default:
      // Unknown org/repo, use it as-is
      return orgRepo;
  }
}

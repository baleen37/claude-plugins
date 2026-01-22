import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Custom plugin to update version in plugin.json files
 * These files don't have a "version" field in standard JSON array format,
 * so we need to manually parse and update them.
 */
function updatePluginJsons() {
  return {
    async prepare(_pluginContext, { nextRelease: { version } }) {
      const plugins = ['auto-updater', 'git-guard', 'me', 'ralph-loop'];

      for (const plugin of plugins) {
        const pluginJsonPath = resolve(
          process.cwd(),
          `plugins/${plugin}/.claude-plugin/plugin.json`
        );
        const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
        pluginJson.version = version;
        writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
      }

      // Update marketplace.json
      const marketplacePath = resolve(process.cwd(), '.claude-plugin/marketplace.json');
      const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));

      // Update all plugin versions in marketplace.json
      marketplace.plugins = marketplace.plugins.map((plugin) => ({
        ...plugin,
        version,
      }));

      writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + '\n');
    },
  };
}

const plugins = [
  '@semantic-release/commit-analyzer',
  '@semantic-release/release-notes-generator',
  updatePluginJsons(),
  [
    '@semantic-release/github',
    {
      successComment: false,
      failComment: false,
    },
  ],
];

export default {
  branches: ['main'],
  plugins,
};

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Dynamically discover all plugins from the plugins directory.
 * A plugin is identified by the presence of .claude-plugin/plugin.json.
 */
function discoverPlugins() {
  const pluginsDir = resolve(process.cwd(), 'plugins');
  const plugins = [];

  for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const pluginJsonPath = resolve(pluginsDir, entry.name, '.claude-plugin/plugin.json');
      if (existsSync(pluginJsonPath)) {
        plugins.push(entry.name);
      }
    }
  }

  return plugins;
}

/**
 * Custom plugin to update version in plugin.json files.
 *
 * Ensures all plugin.json versions are synchronized with marketplace.json
 * during the release process. Each plugin has its own plugin.json that needs
 * to be updated to the same version.
 */
function updatePluginJsons() {
  return {
    async prepare(_pluginContext, { nextRelease: { version } }) {
      const plugins = discoverPlugins();

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
  [
    '@semantic-release/commit-analyzer',
    {
      preset: 'angular',
      releaseRules: [
        { type: 'refactor', release: 'patch' },
        { type: 'chore', release: 'patch' },
        { type: 'docs', release: 'patch' },
        { type: 'style', release: 'patch' },
        { type: 'test', release: 'patch' },
        { type: 'build', release: 'patch' },
        { type: 'ci', release: 'patch' },
        { type: 'perf', release: 'patch' },
      ],
    },
  ],
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

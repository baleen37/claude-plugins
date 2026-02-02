import fs from 'fs/promises';
import path from 'path';

// Get the plugin root directory (memory-persistence plugin)
const PLUGIN_ROOT = process.cwd();
// The marketplace.json is in the root of the monorepo (worktree root)
const WORKTREE_ROOT = path.join(PLUGIN_ROOT, '..', '..');
const MARKETPLACE_JSON = path.join(WORKTREE_ROOT, '.claude-plugin', 'marketplace.json');

describe('Memory Persistence Plugin Structure', () => {
  it('plugin directory structure exists', async () => {
    const pluginDir = await fs.access(PLUGIN_ROOT).then(() => true).catch(() => false);
    expect(pluginDir).toBe(true);

    const claudePluginDir = await fs.access(path.join(PLUGIN_ROOT, '.claude-plugin')).then(() => true).catch(() => false);
    expect(claudePluginDir).toBe(true);

    const hooksDir = await fs.access(path.join(PLUGIN_ROOT, 'hooks')).then(() => true).catch(() => false);
    expect(hooksDir).toBe(true);

    const srcLibDir = await fs.access(path.join(PLUGIN_ROOT, 'src', 'hooks', 'lib')).then(() => true).catch(() => false);
    expect(srcLibDir).toBe(true);
  });

  it('plugin.json is valid JSON', async () => {
    const pluginJsonPath = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
    const content = await fs.readFile(pluginJsonPath, 'utf-8');
    const plugin = JSON.parse(content);

    expect(plugin).toHaveProperty('name', 'memory-persistence');
    expect(plugin).toHaveProperty('version');
    expect(plugin).toHaveProperty('description');
    expect(plugin).toHaveProperty('author');
  });

  it('hooks.json is valid JSON', async () => {
    const hooksJsonPath = path.join(PLUGIN_ROOT, 'hooks', 'hooks.json');
    const content = await fs.readFile(hooksJsonPath, 'utf-8');
    const hooks = JSON.parse(content);

    expect(hooks).toBeDefined();
    expect(Array.isArray(hooks.hooks) || typeof hooks.hooks === 'object').toBe(true);
  });

  it('stop.ts hook exists and is readable', async () => {
    const stopHookPath = path.join(PLUGIN_ROOT, 'src', 'hooks', 'stop.ts');
    await fs.access(stopHookPath, fs.constants.R_OK);
  });

  it('session-start.ts hook exists and is readable', async () => {
    const sessionStartHookPath = path.join(PLUGIN_ROOT, 'src', 'hooks', 'session-start.ts');
    await fs.access(sessionStartHookPath, fs.constants.R_OK);
  });

  it('state.ts library exists and is readable', async () => {
    const stateLibPath = path.join(PLUGIN_ROOT, 'src', 'hooks', 'lib', 'state.ts');
    await fs.access(stateLibPath, fs.constants.R_OK);
  });

  it('marketplace.json includes memory-persistence', async () => {
    const content = await fs.readFile(MARKETPLACE_JSON, 'utf-8');
    const marketplace = JSON.parse(content);

    const memoryPersistencePlugin = marketplace.plugins?.find(
      (p: { name: string }) => p.name === 'memory-persistence'
    );

    expect(memoryPersistencePlugin).toBeDefined();

    // Check version matches plugin.json
    const pluginJsonPath = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
    const pluginContent = await fs.readFile(pluginJsonPath, 'utf-8');
    const pluginJson = JSON.parse(pluginContent);

    expect(memoryPersistencePlugin.version).toBe(pluginJson.version);
  });

  it('has valid TypeScript configuration', async () => {
    const tsconfigPath = path.join(PLUGIN_ROOT, 'tsconfig.json');
    const content = await fs.readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);

    expect(tsconfig).toHaveProperty('compilerOptions');
    expect(tsconfig.compilerOptions).toHaveProperty('target');
    expect(tsconfig.compilerOptions).toHaveProperty('module');
  });

  it('has valid Jest configuration', async () => {
    const jestConfigPath = path.join(PLUGIN_ROOT, 'jest.config.cjs');
    const content = await fs.readFile(jestConfigPath, 'utf-8');

    // Check it's valid JS (module.exports)
    expect(content).toContain('module.exports');
    expect(content).toContain('testMatch');
    expect(content).toContain('ts-jest');
  });

  it('has package.json with test scripts', async () => {
    const packageJsonPath = path.join(PLUGIN_ROOT, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts.test).toBeDefined();
  });

  it('README.md exists and contains relevant information', async () => {
    const readmePath = path.join(PLUGIN_ROOT, 'README.md');
    const content = await fs.readFile(readmePath, 'utf-8');

    expect(content).toContain('memory');
    expect(content.length).toBeGreaterThan(100);
  });
});

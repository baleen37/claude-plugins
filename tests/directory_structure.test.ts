/**
 * Test: Required directory structure
 * Vitest equivalent of tests/directory_structure.bats
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { assertDirExists, assertFileExists, isValidPluginName, PROJECT_ROOT } from './helpers/vitest'

describe('Required directories exist', () => {
  it('should have root .claude-plugin directory', () => {
    expect(() => assertDirExists(join(PROJECT_ROOT, '.claude-plugin'), 'root .claude-plugin directory should exist')).not.toThrow()
  })

  it('should have plugins directory', () => {
    expect(() => assertDirExists(join(PROJECT_ROOT, 'plugins'), 'plugins directory should exist')).not.toThrow()
  })

  it('should have .claude-plugin directory for each plugin', () => {
    const pluginsDir = join(PROJECT_ROOT, 'plugins')
    const plugins = readdirSync(pluginsDir, { withFileTypes: true })

    for (const plugin of plugins) {
      if (plugin.isDirectory()) {
        const pluginClaudeDir = join(pluginsDir, plugin.name, '.claude-plugin')
        expect(() => assertDirExists(pluginClaudeDir, `plugin ${plugin.name} should have .claude-plugin directory`)).not.toThrow()
      }
    }
  })
})

describe('Each plugin has valid plugin.json', () => {
  it('should have plugin.json for each plugin', () => {
    const pluginsDir = join(PROJECT_ROOT, 'plugins')
    const plugins = readdirSync(pluginsDir, { withFileTypes: true })

    for (const plugin of plugins) {
      if (plugin.isDirectory()) {
        const pluginJson = join(pluginsDir, plugin.name, '.claude-plugin', 'plugin.json')
        expect(() => assertFileExists(pluginJson, `plugin ${plugin.name} should have plugin.json`)).not.toThrow()

        // Check file is not empty
        const stats = statSync(pluginJson)
        expect(stats.size).toBeGreaterThan(0)
      }
    }
  })
})

describe('Plugin directories follow naming convention', () => {
  it('should have valid plugin directory names', () => {
    const pluginsDir = join(PROJECT_ROOT, 'plugins')
    const plugins = readdirSync(pluginsDir, { withFileTypes: true })

    for (const plugin of plugins) {
      if (plugin.isDirectory()) {
        expect(() => isValidPluginName(plugin.name)).not.toThrow()
      }
    }
  })
})

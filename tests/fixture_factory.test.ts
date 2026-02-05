/**
 * Test: Fixture Factory for creating test fixtures
 * Vitest equivalent of tests/fixture_factory.bats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, existsSync, mkdirSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import {
  createMinimalPlugin,
  createFullPlugin,
  createCommandFile,
  createAgentFile,
  createSkillFile,
  cleanupFixtures,
  validatePluginName,
  type MinimalPluginOptions,
  type FullPluginOptions,
} from './helpers/fixture-factory'
import { validateJson, assertDirExists, assertFileExists, hasFrontmatterDelimiter, hasFrontmatterField } from './helpers/vitest'

let TEST_TEMP_DIR: string

beforeAll(() => {
  TEST_TEMP_DIR = mkdtempSync('/tmp/fixture-factory-tests-')
})

afterAll(() => {
  if (TEST_TEMP_DIR && existsSync(TEST_TEMP_DIR)) {
    rmSync(TEST_TEMP_DIR, { recursive: true, force: true })
  }
})

describe('create_minimal_plugin creates minimal plugin structure', () => {
  it('should create minimal plugin', async () => {
    const pluginName = 'test-minimal-plugin'
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures')
    mkdirSync(FIXTURE_ROOT, { recursive: true })

    // Create minimal plugin
    const pluginPath = await createMinimalPlugin(FIXTURE_ROOT, pluginName)

    // Verify directory exists
    expect(() => assertDirExists(pluginPath, 'create_minimal_plugin should create plugin directory')).not.toThrow()

    // Verify plugin.json exists and is valid JSON
    const manifest = join(pluginPath, '.claude-plugin', 'plugin.json')
    expect(() => assertFileExists(manifest, 'create_minimal_plugin should create plugin.json')).not.toThrow()
    expect(() => validateJson(manifest)).not.toThrow()

    // Verify required fields
    const data = validateJson<{ name: string; description: string; author: string; version: string }>(manifest)
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('description')
    expect(data).toHaveProperty('author')
    expect(data).toHaveProperty('version')

    // Verify values
    expect(data.name).toBe(pluginName)
    expect(data.version).toBe('1.0.0')
  })
})

describe('create_minimal_plugin validates plugin name format', () => {
  it('should reject invalid name with uppercase', async () => {
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures2')
    mkdirSync(FIXTURE_ROOT, { recursive: true })

    // Invalid name with uppercase
    await expect(createMinimalPlugin(FIXTURE_ROOT, 'InvalidName')).rejects.toThrow()
  })
})

describe('create_full_plugin creates complete plugin structure', () => {
  it('should create full plugin', async () => {
    const pluginName = 'test-full-plugin'
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures3')
    mkdirSync(FIXTURE_ROOT, { recursive: true })

    // Create full plugin
    const pluginPath = await createFullPlugin(FIXTURE_ROOT, pluginName)

    // Verify directory structure
    expect(() => assertDirExists(join(pluginPath, 'commands'), 'create_full_plugin should create commands directory')).not.toThrow()
    expect(() => assertDirExists(join(pluginPath, 'agents'), 'create_full_plugin should create agents directory')).not.toThrow()
    expect(() => assertDirExists(join(pluginPath, 'skills'), 'create_full_plugin should create skills directory')).not.toThrow()
    expect(() => assertDirExists(join(pluginPath, 'hooks'), 'create_full_plugin should create hooks directory')).not.toThrow()

    // Verify plugin.json
    const manifest = join(pluginPath, '.claude-plugin', 'plugin.json')
    expect(() => assertFileExists(manifest, 'create_full_plugin should create plugin.json')).not.toThrow()
    expect(() => validateJson(manifest)).not.toThrow()

    // Verify all required fields
    const data = validateJson(manifest)
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('description')
    expect(data).toHaveProperty('author')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('license')
    expect(data).toHaveProperty('keywords')

    // Verify sample files exist
    expect(() => assertFileExists(join(pluginPath, 'commands', 'example-command.md'), 'create_full_plugin should create example command')).not.toThrow()
    expect(() => assertFileExists(join(pluginPath, 'agents', 'example-agent.md'), 'create_full_plugin should create example agent')).not.toThrow()
    expect(() => assertFileExists(join(pluginPath, 'skills', 'example-skill', 'SKILL.md'), 'create_full_plugin should create example skill')).not.toThrow()
    expect(() => assertFileExists(join(pluginPath, 'hooks', 'hooks.json'), 'create_full_plugin should create hooks.json')).not.toThrow()
  })
})

describe('create_command_file creates valid command file', () => {
  it('should create command file', async () => {
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures4')
    mkdirSync(FIXTURE_ROOT, { recursive: true })
    const pluginPath = join(FIXTURE_ROOT, 'test-command-plugin')
    mkdirSync(join(pluginPath, 'commands'), { recursive: true })

    // Create command file
    await createCommandFile(join(pluginPath, 'commands'), 'test-command', 'Test command description')

    const commandFile = join(pluginPath, 'commands', 'test-command.md')
    expect(() => assertFileExists(commandFile, 'create_command_file should create command file')).not.toThrow()

    // Verify frontmatter delimiter
    const content = readFileSync(commandFile, 'utf-8')
    expect(hasFrontmatterDelimiter(content)).toBe(true)

    // Verify description field
    expect(hasFrontmatterField(content, 'description')).toBe(true)

    // Verify content after frontmatter
    expect(content).toContain('Content for test-command')
  })
})

describe('create_agent_file creates valid agent file', () => {
  it('should create agent file', async () => {
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures5')
    mkdirSync(FIXTURE_ROOT, { recursive: true })
    const pluginPath = join(FIXTURE_ROOT, 'test-agent-plugin')
    mkdirSync(join(pluginPath, 'agents'), { recursive: true })

    // Create agent file
    await createAgentFile(join(pluginPath, 'agents'), 'test-agent', 'Test agent description', 'sonnet')

    const agentFile = join(pluginPath, 'agents', 'test-agent.md')
    expect(() => assertFileExists(agentFile, 'create_agent_file should create agent file')).not.toThrow()

    // Verify frontmatter delimiter
    const content = readFileSync(agentFile, 'utf-8')
    expect(hasFrontmatterDelimiter(content)).toBe(true)

    // Verify required fields
    expect(hasFrontmatterField(content, 'name')).toBe(true)
    expect(hasFrontmatterField(content, 'description')).toBe(true)
    expect(hasFrontmatterField(content, 'model')).toBe(true)

    // Verify model value
    expect(content).toContain('model: sonnet')
  })
})

describe('create_skill_file creates valid skill structure', () => {
  it('should create skill file', async () => {
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures6')
    mkdirSync(FIXTURE_ROOT, { recursive: true })
    const pluginPath = join(FIXTURE_ROOT, 'test-skill-plugin')
    mkdirSync(join(pluginPath, 'skills'), { recursive: true })

    // Create skill file
    await createSkillFile(join(pluginPath, 'skills'), 'test-skill', 'Test skill description')

    const skillDir = join(pluginPath, 'skills', 'test-skill')
    const skillFile = join(skillDir, 'SKILL.md')

    expect(() => assertDirExists(skillDir, 'create_skill_file should create skill directory')).not.toThrow()
    expect(() => assertFileExists(skillFile, 'create_skill_file should create SKILL.md')).not.toThrow()

    // Verify frontmatter delimiter
    const content = readFileSync(skillFile, 'utf-8')
    expect(hasFrontmatterDelimiter(content)).toBe(true)

    // Verify required fields
    expect(hasFrontmatterField(content, 'name')).toBe(true)
    expect(hasFrontmatterField(content, 'description')).toBe(true)

    // Verify content structure
    expect(content).toMatch(/^# /m)
    expect(content).toContain('## Overview')
  })
})

describe('create_skill_file with content creates detailed skill', () => {
  it('should create skill with custom content', async () => {
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures7')
    mkdirSync(FIXTURE_ROOT, { recursive: true })
    const pluginPath = join(FIXTURE_ROOT, 'test-skill-content-plugin')
    mkdirSync(join(pluginPath, 'skills'), { recursive: true })

    const content = `# Overview
This is test content.

## Usage
Use this skill for testing.`

    // Create skill file with content
    await createSkillFile(join(pluginPath, 'skills'), 'test-detailed-skill', 'Test detailed skill', content)

    const skillFile = join(pluginPath, 'skills', 'test-detailed-skill', 'SKILL.md')

    // Verify custom content
    const fileContent = readFileSync(skillFile, 'utf-8')
    expect(fileContent).toContain('# Overview')
    expect(fileContent).toContain('This is test content.')
    expect(fileContent).toContain('## Usage')
  })
})

describe('cleanup_fixtures removes all fixture directories', () => {
  it('should cleanup fixtures', async () => {
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures8')
    mkdirSync(FIXTURE_ROOT, { recursive: true })

    const plugin1 = await createMinimalPlugin(FIXTURE_ROOT, 'cleanup-test-1')
    const plugin2 = await createFullPlugin(FIXTURE_ROOT, 'cleanup-test-2')

    // Verify they exist
    expect(() => assertDirExists(plugin1, 'first plugin should be created')).not.toThrow()
    expect(() => assertDirExists(plugin2, 'second plugin should be created')).not.toThrow()

    // Clean up
    await cleanupFixtures(FIXTURE_ROOT, TEST_TEMP_DIR)

    // Verify they're gone
    expect(existsSync(plugin1)).toBe(false)
    expect(existsSync(plugin2)).toBe(false)
    expect(existsSync(FIXTURE_ROOT)).toBe(false)
  })
})

describe('cleanup_fixtures handles non-existent directory gracefully', () => {
  it('should not fail with non-existent directory', async () => {
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures9')
    const nonExistent = join(FIXTURE_ROOT, 'non-existent-path')

    // Should not fail even if directory doesn't exist
    await expect(cleanupFixtures(nonExistent, TEST_TEMP_DIR)).resolves.toBeUndefined()
  })
})

describe('create_minimal_plugin with custom options', () => {
  it('should create plugin with custom version and author', async () => {
    const pluginName = 'test-custom-plugin'
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures10')
    mkdirSync(FIXTURE_ROOT, { recursive: true })

    // Create with custom version and author
    const pluginPath = await createMinimalPlugin(FIXTURE_ROOT, pluginName, {
      version: '2.5.0',
      author: 'Custom Author',
    })

    const manifest = join(pluginPath, '.claude-plugin', 'plugin.json')
    const data = validateJson<{ version: string; author: string }>(manifest)

    expect(data.version).toBe('2.5.0')
    expect(data.author).toContain('Custom Author')
  })
})

describe('create_full_plugin includes hooks.json with valid structure', () => {
  it('should create hooks.json with valid structure', async () => {
    const pluginName = 'test-hooks-plugin'
    const FIXTURE_ROOT = join(TEST_TEMP_DIR, 'fixtures11')
    mkdirSync(FIXTURE_ROOT, { recursive: true })

    const pluginPath = await createFullPlugin(FIXTURE_ROOT, pluginName)

    const hooksFile = join(pluginPath, 'hooks', 'hooks.json')
    expect(() => assertFileExists(hooksFile, 'create_full_plugin should create hooks.json')).not.toThrow()

    // Verify valid JSON
    expect(() => validateJson(hooksFile)).not.toThrow()

    // Verify required fields
    const data = validateJson(hooksFile)
    expect(data).toHaveProperty('description')
    expect(data).toHaveProperty('hooks')
  })
})

describe('fixture factory generates valid plugin names only', () => {
  it('should validate plugin names', () => {
    // Valid name
    expect(() => validatePluginName('valid-name-123')).not.toThrow()

    // Invalid names
    expect(() => validatePluginName('test_plugin')).toThrow()
    expect(() => validatePluginName('TestPlugin')).toThrow()
    expect(() => validatePluginName('test.plugin')).toThrow()
  })
})

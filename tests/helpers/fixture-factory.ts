/**
 * Fixture Factory for Vitest tests
 *
 * TypeScript equivalent of tests/helpers/fixture_factory.bash
 * Provides helper functions to create test fixtures for Claude Code plugins.
 *
 * Usage:
 *   import { createMinimalPlugin, createFullPlugin, cleanupFixtures } from './helpers/fixture-factory'
 *
 *   // Create a minimal plugin for testing
 *   const pluginPath = await createMinimalPlugin(testDir, 'my-plugin')
 *
 *   // Create a full plugin with all components
 *   const fullPlugin = await createFullPlugin(testDir, 'full-plugin')
 *
 *   // Create individual component files
 *   await createCommandFile(`${pluginPath}/commands`, 'my-command', 'Description')
 *   await createAgentFile(`${pluginPath}/agents`, 'my-agent', 'Description', 'sonnet')
 *   await createSkillFile(`${pluginPath}/skills`, 'my-skill', 'Description')
 *
 *   // Clean up fixtures
 *   await cleanupFixtures(fixtureRoot)
 */

import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Default values
const DEFAULT_VERSION = '1.0.0'
const DEFAULT_AUTHOR = 'Test Author <test@example.com>'
const DEFAULT_LICENSE = 'MIT'
const DEFAULT_DESCRIPTION = 'Test plugin description'

/**
 * Minimal plugin options
 */
export interface MinimalPluginOptions {
  version?: string
  author?: string
}

/**
 * Full plugin options
 */
export interface FullPluginOptions extends MinimalPluginOptions {
  license?: string
  keywords?: string[]
}

/**
 * Validate plugin name format (lowercase, hyphens, numbers only)
 */
export function validatePluginName(name: string): void {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid plugin name '${name}'. Plugin names must be lowercase with hyphens only.`)
  }
}

/**
 * Create minimal plugin structure with plugin.json only
 *
 * @param baseDir - Base directory for plugins
 * @param pluginName - Name of the plugin
 * @param options - Optional version and author
 * @returns Path to created plugin
 */
export async function createMinimalPlugin(
  baseDir: string,
  pluginName: string,
  options: MinimalPluginOptions = {}
): Promise<string> {
  const version = options.version ?? DEFAULT_VERSION
  const author = options.author ?? DEFAULT_AUTHOR

  // Validate plugin name
  validatePluginName(pluginName)

  const pluginPath = join(baseDir, pluginName)
  const manifestDir = join(pluginPath, '.claude-plugin')
  const manifestFile = join(manifestDir, 'plugin.json')

  // Create directory structure
  await mkdir(manifestDir, { recursive: true })

  // Create plugin.json
  const manifest = {
    name: pluginName,
    version,
    description: DEFAULT_DESCRIPTION,
    author,
  }

  await writeFile(manifestFile, JSON.stringify(manifest, null, 2))

  return pluginPath
}

/**
 * Create full plugin structure with all components
 *
 * @param baseDir - Base directory for plugins
 * @param pluginName - Name of the plugin
 * @param options - Optional version, author, license, and keywords
 * @returns Path to created plugin
 */
export async function createFullPlugin(
  baseDir: string,
  pluginName: string,
  options: FullPluginOptions = {}
): Promise<string> {
  const version = options.version ?? DEFAULT_VERSION
  const author = options.author ?? DEFAULT_AUTHOR
  const license = options.license ?? DEFAULT_LICENSE
  const keywords = options.keywords ?? ['test', 'fixture']

  // Create minimal plugin first
  const pluginPath = await createMinimalPlugin(baseDir, pluginName, { version, author })

  // Update plugin.json with additional fields
  const manifestFile = join(pluginPath, '.claude-plugin', 'plugin.json')
  const manifest = JSON.parse(await import('fs/promises').then(fs => fs.readFile(manifestFile, 'utf-8')))

  manifest.license = license
  manifest.keywords = keywords

  await writeFile(manifestFile, JSON.stringify(manifest, null, 2))

  // Create directory structure
  await mkdir(join(pluginPath, 'commands'), { recursive: true })
  await mkdir(join(pluginPath, 'agents'), { recursive: true })
  await mkdir(join(pluginPath, 'skills'), { recursive: true })
  await mkdir(join(pluginPath, 'hooks'), { recursive: true })

  // Create sample files
  await createCommandFile(join(pluginPath, 'commands'), 'example-command', 'Example command description')
  await createAgentFile(join(pluginPath, 'agents'), 'example-agent', 'Example agent description', 'sonnet')
  await createSkillFile(join(pluginPath, 'skills'), 'example-skill', 'Example skill description')

  // Create hooks.json
  const hooksFile = join(pluginPath, 'hooks', 'hooks.json')
  const hooks = {
    description: 'Example hooks configuration',
    hooks: {
      SessionStart: [],
    },
  }

  await writeFile(hooksFile, JSON.stringify(hooks, null, 2))

  return pluginPath
}

/**
 * Create a command file with frontmatter
 *
 * @param commandsDir - Path to commands directory
 * @param commandName - Name of the command
 * @param description - Command description
 */
export async function createCommandFile(
  commandsDir: string,
  commandName: string,
  description: string
): Promise<void> {
  const commandFile = join(commandsDir, `${commandName}.md`)

  const content = `---
description: ${description}
---

Content for ${commandName}
`

  await writeFile(commandFile, content)
}

/**
 * Create an agent file with frontmatter
 *
 * @param agentsDir - Path to agents directory
 * @param agentName - Name of the agent
 * @param description - Agent description
 * @param model - Model to use (default: 'sonnet')
 */
export async function createAgentFile(
  agentsDir: string,
  agentName: string,
  description: string,
  model: string = 'sonnet'
): Promise<void> {
  const agentFile = join(agentsDir, `${agentName}.md`)

  const content = `---
name: ${agentName}
description: |
  ${description}
model: ${model}
---

You are a specialized agent for ${agentName}.
`

  await writeFile(agentFile, content)
}

/**
 * Create a skill directory and SKILL.md file
 *
 * @param skillsDir - Path to skills directory
 * @param skillName - Name of the skill
 * @param description - Skill description
 * @param content - Optional custom content
 */
export async function createSkillFile(
  skillsDir: string,
  skillName: string,
  description: string,
  content: string = ''
): Promise<void> {
  const skillDir = join(skillsDir, skillName)
  const skillFile = join(skillDir, 'SKILL.md')

  await mkdir(skillDir, { recursive: true })

  // If custom content provided, use it; otherwise generate default
  if (content) {
    const skillContent = `---
name: ${skillName}
description: ${description}
---

${content}
`
    await writeFile(skillFile, skillContent)
  } else {
    // Capitalize first letter for title
    const skillNameCap = skillName.charAt(0).toUpperCase() + skillName.slice(1)

    const defaultContent = `---
name: ${skillName}
description: ${description}
---

# ${skillNameCap}

## Overview

This is a test skill for ${skillName}.

## Usage

Use this skill when you need to test ${skillName} functionality.
`
    await writeFile(skillFile, defaultContent)
  }
}

/**
 * Clean up fixture directories
 *
 * @param fixtureRoot - Root directory of fixtures to clean up
 * @param testTempDir - Test temp directory (for safety check)
 */
export async function cleanupFixtures(fixtureRoot: string, testTempDir: string): Promise<void> {
  // Only remove if it exists and is under testTempDir
  if (fixtureRoot.startsWith(testTempDir)) {
    if (existsSync(fixtureRoot)) {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  }
}

/**
 * Bun test helper for claude-plugins project
 * TypeScript equivalent of bats_helper.bash
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the current file path and resolve project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Resolve PROJECT_ROOT: tests/helpers/bun.ts -> tests/ -> project_root
export const PROJECT_ROOT = dirname(dirname(__dirname))

// Export common paths
export const WORKFLOW_DIR = join(PROJECT_ROOT, '.github', 'workflows')
export const PLUGINS_DIR = join(PROJECT_ROOT, 'plugins')

// Allowed fields in plugin.json
const ALLOWED_FIELDS = new Set([
  'name',
  'description',
  'author',
  'version',
  'license',
  'homepage',
  'repository',
  'keywords',
  'lspServers',
])

// Allowed author fields
const ALLOWED_AUTHOR_FIELDS = new Set(['name', 'email'])

/**
 * Plugin manifest interface
 */
export interface PluginManifest {
  name: string
  description: string
  author: AuthorInfo | string
  version?: string
  license?: string
  homepage?: string
  repository?: string
  keywords?: string[]
  lspServers?: string[]
}

/**
 * Author information interface
 */
export interface AuthorInfo {
  name?: string
  email?: string
}

/**
 * Validate JSON file - returns parsed data or throws
 */
export function validateJson<T = unknown>(path: string): T {
  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Assert file exists with optional custom message
 */
export function assertFileExists(path: string, message?: string): void {
  if (!existsSync(path)) {
    throw new Error(message || `File not found: ${path}`)
  }
}

/**
 * Assert directory exists with optional custom message
 */
export function assertDirExists(path: string, message?: string): void {
  if (!existsSync(path)) {
    throw new Error(message || `Directory not found: ${path}`)
  }
}

/**
 * Assert value is not empty with optional custom message
 */
export function assertNotEmpty(value: string, message?: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(message || 'Value should not be empty')
  }
}

/**
 * Assert equality with optional custom message
 */
export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Values should be equal.\n  Expected: ${expected}\n  Actual:   ${actual}`
    )
  }
}

/**
 * Assert value matches regex pattern
 */
export function assertMatches(value: string, regex: RegExp, message?: string): void {
  if (!regex.test(value)) {
    throw new Error(message || `Value should match pattern ${regex.toString()}. Got: ${value}`)
  }
}

/**
 * Check if plugin name follows naming convention
 * Must be lowercase with hyphens and numbers only
 */
export function isValidPluginName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name)
}

/**
 * Assert plugin name is valid
 */
export function assertValidPluginName(name: string): void {
  if (!isValidPluginName(name)) {
    throw new Error(`Invalid plugin name '${name}'. Must be lowercase with hyphens and numbers only.`)
  }
}

/**
 * Check if string is valid semver (major.minor.patch)
 */
export function isValidSemver(version: string): boolean {
  return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)
}

/**
 * Check if JSON field is allowed in plugin.json
 */
export function isJsonFieldAllowed(field: string): boolean {
  return ALLOWED_FIELDS.has(field)
}

/**
 * Check if author field is allowed
 */
export function isAuthorFieldAllowed(field: string): boolean {
  return ALLOWED_AUTHOR_FIELDS.has(field)
}

/**
 * Validate plugin manifest has only allowed fields
 */
export function validatePluginManifestFields(manifest: PluginManifest, path: string): void {
  const fields = Object.keys(manifest)

  for (const field of fields) {
    if (!isJsonFieldAllowed(field)) {
      throw new Error(
        `Invalid field '${field}' in ${path}. Allowed fields: ${Array.from(ALLOWED_FIELDS).join(', ')}`
      )
    }
  }

  // Check nested author fields if author is an object
  if (manifest.author && typeof manifest.author === 'object') {
    const authorFields = Object.keys(manifest.author)
    for (const field of authorFields) {
      if (!isAuthorFieldAllowed(field)) {
        throw new Error(
          `Invalid author field 'author.${field}' in ${path}. Allowed author fields: ${Array.from(ALLOWED_AUTHOR_FIELDS).join(', ')}`
        )
      }
    }
  }
}

/**
 * Get all plugin manifest paths
 * Includes both root canonical plugin and plugins directory plugins.
 */
export function getAllPluginManifests(): string[] {
  const manifests: string[] = []

  // Check for root canonical plugin
  const rootManifestPath = join(PROJECT_ROOT, '.claude-plugin', 'plugin.json')
  if (existsSync(rootManifestPath)) {
    manifests.push(rootManifestPath)
  }

  try {
    const plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true })

    for (const plugin of plugins) {
      if (plugin.isDirectory()) {
        const manifestPath = join(PLUGINS_DIR, plugin.name, '.claude-plugin', 'plugin.json')
        if (existsSync(manifestPath)) {
          manifests.push(manifestPath)
        }
      }
    }
  } catch (error) {
    // Plugins directory might not exist
  }

  return manifests
}

/**
 * Parse and cache plugin manifests
 */
export function parsePluginManifest(path: string): PluginManifest {
  return validateJson<PluginManifest>(path)
}

/**
 * Check if file has frontmatter delimiter (--- at line 1)
 */
export function hasFrontmatterDelimiter(content: string): boolean {
  const firstLine = content.split('\n')[0]
  return firstLine.trim() === '---'
}

/**
 * Check if file has frontmatter field
 */
export function hasFrontmatterField(content: string, field: string): boolean {
  const regex = new RegExp(`^${field}:`, 'm')
  return regex.test(content)
}

/**
 * Marketplace manifest interface
 */
export interface MarketplaceManifest {
  name: string
  owner: {
    name: string
  }
  plugins: MarketplacePlugin[]
}

/**
 * Marketplace plugin interface
 */
export interface MarketplacePlugin {
  source: string
  name?: string
  description?: string
}

/**
 * Get all hooks.json paths
 */
export function getAllHooksJson(): string[] {
  const hooksFiles: string[] = []

  try {
    const plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true })

    for (const plugin of plugins) {
      if (plugin.isDirectory()) {
        const hooksPath = join(PLUGINS_DIR, plugin.name, 'hooks', 'hooks.json')
        if (existsSync(hooksPath)) {
          hooksFiles.push(hooksPath)
        }
      }
    }
  } catch (error) {
    return []
  }

  return hooksFiles
}

/**
 * Hooks manifest interface
 */
export interface HooksManifest {
  hooks: Record<string, HookEntry[]>
}

/**
 * Hook entry interface
 */
export interface HookEntry {
  matcher?: string
  hooks: HookConfig[]
}

/**
 * Hook configuration interface
 */
export interface HookConfig {
  type: 'command' | 'prompt' | 'agent'
  command?: string
  prompt?: string
  agent?: string
}

/**
 * Validate hooks.json structure
 */
export function validateHooksManifest(hooks: HooksManifest, path: string): void {
  if (!hooks.hooks || typeof hooks.hooks !== 'object') {
    throw new Error(`hooks.json must have a 'hooks' object at ${path}`)
  }

  for (const [eventName, entries] of Object.entries(hooks.hooks)) {
    if (!Array.isArray(entries)) {
      throw new Error(`hooks.hooks['${eventName}'] must be an array at ${path}`)
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      if (!entry.matcher) {
        throw new Error(`hooks.hooks['${eventName}'][${i}] must have a 'matcher' field at ${path}`)
      }

      if (!Array.isArray(entry.hooks)) {
        throw new Error(`hooks.hooks['${eventName}'][${i}].hooks must be an array at ${path}`)
      }

      for (let j = 0; j < entry.hooks.length; j++) {
        const hook = entry.hooks[j]

        if (!hook.type) {
          throw new Error(`hooks.hooks['${eventName}'][${i}].hooks[${j}] must have a 'type' field at ${path}`)
        }

        if (!['command', 'prompt', 'agent'].includes(hook.type)) {
          throw new Error(`hooks.hooks['${eventName}'][${i}].hooks[${j}].type must be 'command', 'prompt', or 'agent' at ${path}`)
        }

        if (hook.type === 'command' && !hook.command) {
          throw new Error(`hooks.hooks['${eventName}'][${i}].hooks[${j}] must have a 'command' field when type is 'command' at ${path}`)
        }
      }
    }
  }
}

/**
 * Check if hooks.json uses portable CLAUDE_PLUGIN_ROOT paths
 */
export function validateHooksPortablePaths(hooks: HooksManifest, path: string): void {
  const commandPattern = /^\// // Matches absolute paths starting with /

  for (const entries of Object.values(hooks.hooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        if (hook.type === 'command' && hook.command) {
          if (commandPattern.test(hook.command)) {
            throw new Error(
              `Found hardcoded absolute path in ${path}. Use \${CLAUDE_PLUGIN_ROOT} instead. Command: ${hook.command}`
            )
          }
        }
      }
    }
  }
}

/**
 * Get all plugin directories
 */
export function getAllPluginDirectories(): string[] {
  const pluginDirs: string[] = []

  try {
    const plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true })

    for (const plugin of plugins) {
      if (plugin.isDirectory()) {
        const manifestPath = join(PLUGINS_DIR, plugin.name, '.claude-plugin', 'plugin.json')
        if (existsSync(manifestPath)) {
          pluginDirs.push(plugin.name)
        }
      }
    }
  } catch (error) {
    return []
  }

  return pluginDirs
}

/**
 * Check if all plugins are listed in marketplace.json
 * Supports both root canonical plugin (source: "./") and plugins directory plugins (source: "./plugins/<name>")
 */
export function validateMarketplaceIncludesAllPlugins(
  marketplace: MarketplaceManifest,
  marketplacePath: string
): void {
  const pluginDirs = getAllPluginDirectories()

  // Extract plugin names from marketplace - support both "./" and "./plugins/<name>" formats
  const marketplacePluginNames = new Set<string>()

  for (const p of marketplace.plugins) {
    if (p.name) {
      // Use explicit name if available
      marketplacePluginNames.add(p.name)
    } else {
      // Fallback: extract from source path
      // "./" means root plugin, "./plugins/<name>" means plugins directory
      if (p.source === './') {
        // Root plugin - need to read its name from plugin.json
        const rootManifestPath = join(PROJECT_ROOT, '.claude-plugin', 'plugin.json')
        if (existsSync(rootManifestPath)) {
          try {
            const manifest = validateJson<PluginManifest>(rootManifestPath)
            if (manifest.name) {
              marketplacePluginNames.add(manifest.name)
            }
          } catch {
            // Ignore parse errors
          }
        }
      } else {
        // Extract from "./plugins/<name>" format
        const match = p.source.match(/^\.\/plugins\/([^/]+)$/)
        if (match) {
          marketplacePluginNames.add(match[1])
        }
      }
    }
  }

  // Check for root canonical plugin
  const rootPluginJsonPath = join(PROJECT_ROOT, '.claude-plugin', 'plugin.json')
  if (existsSync(rootPluginJsonPath)) {
    try {
      const rootManifest = validateJson<PluginManifest>(rootPluginJsonPath)
      if (rootManifest.name && !marketplacePluginNames.has(rootManifest.name)) {
        throw new Error(
          `Root plugin '${rootManifest.name}' missing from ${marketplacePath}`
        )
      }
    } catch (error) {
      // Re-throw if it's our validation error
      if (error instanceof Error && error.message.includes('missing from')) {
        throw error
      }
      // Ignore other parse errors
    }
  }

  const missingPlugins: string[] = []

  for (const pluginDir of pluginDirs) {
    // Get the actual plugin name from its manifest
    const manifestPath = join(PLUGINS_DIR, pluginDir, '.claude-plugin', 'plugin.json')
    try {
      const manifest = validateJson<PluginManifest>(manifestPath)
      if (manifest.name && !marketplacePluginNames.has(manifest.name)) {
        missingPlugins.push(manifest.name)
      }
    } catch {
      // Fallback to directory name if manifest is invalid
      if (!marketplacePluginNames.has(pluginDir)) {
        missingPlugins.push(pluginDir)
      }
    }
  }

  if (missingPlugins.length > 0) {
    throw new Error(`Plugins missing from ${marketplacePath}: ${missingPlugins.join(', ')}`)
  }
}

/**
 * Check if marketplace plugin sources point to existing directories
 */
export function validateMarketplacePluginSources(marketplace: MarketplaceManifest, projectRoot: string): void {
  for (const plugin of marketplace.plugins) {
    const fullPath = join(projectRoot, plugin.source)

    if (!existsSync(fullPath)) {
      throw new Error(`Plugin source '${plugin.source}' does not exist at ${fullPath}`)
    }

    const manifestPath = join(fullPath, '.claude-plugin', 'plugin.json')
    if (!existsSync(manifestPath)) {
      throw new Error(`Plugin source '${plugin.source}' does not have plugin.json at ${manifestPath}`)
    }
  }
}

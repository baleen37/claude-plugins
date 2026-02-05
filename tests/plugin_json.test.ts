/**
 * Test: plugin.json validation
 * Vitest equivalent of tests/plugin_json.bats
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  validateJson,
  getAllPluginManifests,
  parsePluginManifest,
  assertValidPluginName,
  assertNotEmpty,
  validatePluginManifestFields,
  type PluginManifest,
} from './helpers/vitest'

let manifests: string[]

beforeAll(() => {
  manifests = getAllPluginManifests()
})

describe('plugin.json exists', () => {
  it('should find at least one plugin.json file', () => {
    expect(manifests.length).toBeGreaterThan(0)
  })
})

describe('plugin.json is valid JSON', () => {
  it('should have valid JSON for all plugin.json files', () => {
    for (const manifest of manifests) {
      expect(() => validateJson(manifest)).not.toThrow()
    }
  })
})

describe('plugin.json has required fields', () => {
  it('should have name field for all plugin.json files', () => {
    for (const manifest of manifests) {
      const data = validateJson<PluginManifest>(manifest)
      expect(data).toHaveProperty('name')
    }
  })

  it('should have description field for all plugin.json files', () => {
    for (const manifest of manifests) {
      const data = validateJson<PluginManifest>(manifest)
      expect(data).toHaveProperty('description')
    }
  })

  it('should have author field for all plugin.json files', () => {
    for (const manifest of manifests) {
      const data = validateJson<PluginManifest>(manifest)
      expect(data).toHaveProperty('author')
    }
  })
})

describe('plugin.json name follows naming convention', () => {
  it('should have valid plugin name for all plugin.json files', () => {
    for (const manifest of manifests) {
      const manifestData = parsePluginManifest(manifest)
      expect(() => assertValidPluginName(manifestData.name)).not.toThrow()
    }
  })
})

describe('plugin.json fields are not empty', () => {
  it('should have non-empty name field for all plugin.json files', () => {
    for (const manifest of manifests) {
      const manifestData = parsePluginManifest(manifest)
      expect(() => assertNotEmpty(manifestData.name, `plugin.json name field should not be empty in ${manifest}`)).not.toThrow()
    }
  })

  it('should have non-empty description field for all plugin.json files', () => {
    for (const manifest of manifests) {
      const manifestData = parsePluginManifest(manifest)
      expect(() => assertNotEmpty(manifestData.description, `plugin.json description field should not be empty in ${manifest}`)).not.toThrow()
    }
  })

  it('should have non-empty author field for all plugin.json files', () => {
    for (const manifest of manifests) {
      const manifestData = parsePluginManifest(manifest)
      const authorValue = typeof manifestData.author === 'string' ? manifestData.author : manifestData.author.name || ''
      expect(() => assertNotEmpty(authorValue, `plugin.json author field should not be empty in ${manifest}`)).not.toThrow()
    }
  })
})

describe('plugin.json uses only allowed fields', () => {
  it('should only use allowed fields for all plugin.json files', () => {
    for (const manifest of manifests) {
      const manifestData = parsePluginManifest(manifest)
      expect(() => validatePluginManifestFields(manifestData, manifest)).not.toThrow()
    }
  })
})

describe('all plugin.json files use only allowed fields', () => {
  it('should validate all manifests without errors', () => {
    const errors: string[] = []

    for (const manifest of manifests) {
      try {
        const manifestData = parsePluginManifest(manifest)
        validatePluginManifestFields(manifestData, manifest)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    expect(errors).toHaveLength(0)
    if (errors.length > 0) {
      throw new Error(`Found invalid fields:\n${errors.join('\n')}`)
    }
  })
})

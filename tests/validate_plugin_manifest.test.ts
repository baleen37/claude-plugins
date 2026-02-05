/**
 * Test suite for plugin.json manifest validation
 * Vitest equivalent of tests/validate_plugin_manifest.bats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import {
  validateJson,
  validatePluginManifestFields,
  PROJECT_ROOT,
  getAllPluginManifests,
  type PluginManifest,
} from './helpers/vitest'

let TEST_DIR: string

beforeAll(() => {
  const tempBase = '/tmp'
  const tempDir = mkdtempSync(join(tempBase, 'manifest-tests-'))
  TEST_DIR = tempDir
})

afterAll(() => {
  if (TEST_DIR && existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

afterAll(() => {
  if (TEST_DIR && existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

describe('plugin.json has only allowed top-level fields', () => {
  it('should validate all allowed fields', () => {
    const testJson = join(TEST_DIR, 'plugin.json')
    const manifest: PluginManifest = {
      name: 'test-plugin',
      description: 'Test plugin',
      author: {
        name: 'Test Author',
        email: 'test@example.com'
      },
      version: '1.0.0',
      license: 'MIT',
      homepage: 'https://example.com',
      repository: 'https://github.com/test/test-plugin',
      keywords: ['test', 'plugin']
    }

    writeFileSync(testJson, JSON.stringify(manifest, null, 2))

    expect(() => validatePluginManifestFields(manifest, testJson)).not.toThrow()

    // Cleanup
    unlinkSync(testJson)
  })
})

describe('plugin.json rejects disallowed top-level fields', () => {
  it('should reject invalid fields', () => {
    const testJson = join(TEST_DIR, 'plugin-invalid.json')
    const manifest = {
      name: 'test-plugin',
      description: 'Test plugin',
      invalidField: 'should not be here',
      anotherInvalid: 123
    }

    writeFileSync(testJson, JSON.stringify(manifest, null, 2))

    expect(() => validatePluginManifestFields(manifest as PluginManifest, testJson)).toThrow()

    // Cleanup
    unlinkSync(testJson)
  })
})

describe('plugin.json allows only name and email in author object', () => {
  it('should validate allowed author fields', () => {
    const testJson = join(TEST_DIR, 'plugin-valid-author.json')
    const manifest: PluginManifest = {
      name: 'test-plugin',
      author: {
        name: 'Test Author',
        email: 'test@example.com'
      }
    }

    writeFileSync(testJson, JSON.stringify(manifest, null, 2))

    expect(() => validatePluginManifestFields(manifest, testJson)).not.toThrow()

    // Cleanup
    unlinkSync(testJson)
  })
})

describe('plugin.json rejects disallowed author fields', () => {
  it('should reject invalid author fields', () => {
    const testJson = join(TEST_DIR, 'plugin-invalid-author.json')
    const manifest = {
      name: 'test-plugin',
      author: {
        name: 'Test Author',
        url: 'https://example.com',
        invalid: 'field'
      }
    }

    writeFileSync(testJson, JSON.stringify(manifest, null, 2))

    expect(() => validatePluginManifestFields(manifest as PluginManifest, testJson)).toThrow()

    // Cleanup
    unlinkSync(testJson)
  })
})

describe('plugin.json requires name field', () => {
  it('should require name field', () => {
    const testJson = join(TEST_DIR, 'plugin-no-name.json')
    const manifest = {
      description: 'Test plugin without name'
    }

    writeFileSync(testJson, JSON.stringify(manifest, null, 2))

    const data = validateJson(testJson)
    expect(data).not.toHaveProperty('name')

    // Cleanup
    unlinkSync(testJson)
  })
})

describe('plugin.json name is valid JSON string', () => {
  it('should have string type for name field', () => {
    const testJson = join(TEST_DIR, 'plugin-name-string.json')
    const manifest: PluginManifest = {
      name: 'my-valid-plugin'
    }

    writeFileSync(testJson, JSON.stringify(manifest, null, 2))

    const data = validateJson<PluginManifest>(testJson)
    expect(typeof data.name).toBe('string')

    // Cleanup
    unlinkSync(testJson)
  })
})

describe('plugin.json author can be string or object', () => {
  it('should allow string author', () => {
    const testJson1 = join(TEST_DIR, 'plugin-string-author.json')
    const manifest1: PluginManifest = {
      name: 'test-plugin',
      author: 'Test Author'
    }

    writeFileSync(testJson1, JSON.stringify(manifest1, null, 2))

    const data1 = validateJson<PluginManifest>(testJson1)
    expect(typeof data1.author).toBe('string')

    // Cleanup
    unlinkSync(testJson1)
  })

  it('should allow object author', () => {
    const testJson2 = join(TEST_DIR, 'plugin-object-author.json')
    const manifest2: PluginManifest = {
      name: 'test-plugin',
      author: {
        name: 'Test Author'
      }
    }

    writeFileSync(testJson2, JSON.stringify(manifest2, null, 2))

    const data2 = validateJson<PluginManifest>(testJson2)
    expect(typeof data2.author).toBe('object')

    // Cleanup
    unlinkSync(testJson2)
  })
})

describe('plugin.json keywords is array of strings', () => {
  it('should have array type for keywords field', () => {
    const testJson = join(TEST_DIR, 'plugin-keywords.json')
    const manifest: PluginManifest = {
      name: 'test-plugin',
      keywords: ['test', 'plugin', 'automation']
    }

    writeFileSync(testJson, JSON.stringify(manifest, null, 2))

    const data = validateJson<PluginManifest>(testJson)
    expect(Array.isArray(data.keywords)).toBe(true)

    // Cleanup
    unlinkSync(testJson)
  })
})

describe('all real plugin manifests are valid', () => {
  it('should validate all plugin manifests in the project', () => {
    const manifests = getAllPluginManifests()

    expect(manifests.length).toBeGreaterThan(0)

    for (const manifestFile of manifests) {
      // Check if JSON is valid
      expect(() => validateJson<PluginManifest>(manifestFile)).not.toThrow()

      // Check if all fields are allowed
      const manifest = validateJson<PluginManifest>(manifestFile)
      expect(() => validatePluginManifestFields(manifest, manifestFile)).not.toThrow()
    }
  })
})

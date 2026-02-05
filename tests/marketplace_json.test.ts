/**
 * Test: marketplace.json validation
 * Vitest equivalent of tests/marketplace_json.bats
 */

import { describe, it, expect } from 'vitest'
import {
  validateJson,
  assertFileExists,
  assertNotEmpty,
  validateMarketplaceIncludesAllPlugins,
  validateMarketplacePluginSources,
  PROJECT_ROOT,
  type MarketplaceManifest,
} from './helpers/vitest'

const MARKETPLACE_JSON = `${PROJECT_ROOT}/.claude-plugin/marketplace.json`

describe('marketplace.json exists', () => {
  it('should exist', () => {
    expect(() => assertFileExists(MARKETPLACE_JSON, 'marketplace.json should exist')).not.toThrow()
  })
})

describe('marketplace.json is valid JSON', () => {
  it('should be valid JSON', () => {
    expect(() => validateJson<MarketplaceManifest>(MARKETPLACE_JSON)).not.toThrow()
  })
})

describe('marketplace.json has required fields', () => {
  it('should have name field', () => {
    const data = validateJson<MarketplaceManifest>(MARKETPLACE_JSON)
    expect(data).toHaveProperty('name')
  })

  it('should have owner.name field', () => {
    const data = validateJson<MarketplaceManifest>(MARKETPLACE_JSON)
    expect(data).toHaveProperty('owner.name')
  })

  it('should have plugins field', () => {
    const data = validateJson<MarketplaceManifest>(MARKETPLACE_JSON)
    expect(data).toHaveProperty('plugins')
  })
})

describe('marketplace.json owner.name is not empty', () => {
  it('should have non-empty owner.name', () => {
    const data = validateJson<MarketplaceManifest>(MARKETPLACE_JSON)
    expect(() => assertNotEmpty(data.owner.name, 'marketplace.json owner.name field should not be empty')).not.toThrow()
  })
})

describe('marketplace.json plugins array exists', () => {
  it('should have plugins as an array', () => {
    const data = validateJson<MarketplaceManifest>(MARKETPLACE_JSON)
    expect(Array.isArray(data.plugins)).toBe(true)
  })
})

describe('marketplace.json includes all plugins in plugins/ directory', () => {
  it('should list all plugin directories', () => {
    const data = validateJson<MarketplaceManifest>(MARKETPLACE_JSON)
    expect(() => validateMarketplaceIncludesAllPlugins(data, MARKETPLACE_JSON)).not.toThrow()
  })
})

describe('marketplace.json plugin sources point to existing directories', () => {
  it('should have valid plugin sources', () => {
    const data = validateJson<MarketplaceManifest>(MARKETPLACE_JSON)
    expect(() => validateMarketplacePluginSources(data, PROJECT_ROOT)).not.toThrow()
  })
})

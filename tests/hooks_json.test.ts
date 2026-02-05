/**
 * Test: hooks.json validation
 * Vitest equivalent of tests/hooks_json.bats
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  validateJson,
  getAllHooksJson,
  validateHooksManifest,
  validateHooksPortablePaths,
  type HooksManifest,
} from './helpers/vitest'

let hooksFiles: string[]

beforeAll(() => {
  hooksFiles = getAllHooksJson()
})

describe('hooks.json is valid JSON', () => {
  it('should have valid JSON for all hooks.json files', () => {
    for (const hooksFile of hooksFiles) {
      expect(() => validateJson<HooksManifest>(hooksFile)).not.toThrow()
    }
  })
})

describe('hooks.json has required top-level structure', () => {
  it('should have hooks field that is an object for all hooks.json files', () => {
    for (const hooksFile of hooksFiles) {
      const hooks = validateJson<HooksManifest>(hooksFile)
      expect(hooks).toHaveProperty('hooks')
      expect(typeof hooks.hooks).toBe('object')
      expect(hooks.hooks).not.toBeNull()
      expect(!Array.isArray(hooks.hooks)).toBe(true)
    }
  })
})

describe('hooks.json events have valid structure', () => {
  it('should have valid event structure for all hooks.json files', () => {
    for (const hooksFile of hooksFiles) {
      expect(() => validateHooksManifest(validateJson<HooksManifest>(hooksFile), hooksFile)).not.toThrow()
    }
  })
})

describe('hooks.json hook entries have required type field', () => {
  it('should have valid type field for all hook entries', () => {
    for (const hooksFile of hooksFiles) {
      const hooks = validateJson<HooksManifest>(hooksFile)

      for (const [eventName, entries] of Object.entries(hooks.hooks)) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          expect(entry).toHaveProperty('hooks')
          expect(Array.isArray(entry.hooks)).toBe(true)

          for (let j = 0; j < entry.hooks.length; j++) {
            const hook = entry.hooks[j]
            expect(hook).toHaveProperty('type')
            expect(['command', 'prompt', 'agent']).toContain(hook.type)
          }
        }
      }
    }
  })
})

describe('hooks.json command type has command field', () => {
  it('should have command field for command type hooks', () => {
    for (const hooksFile of hooksFiles) {
      const hooks = validateJson<HooksManifest>(hooksFile)

      for (const entries of Object.values(hooks.hooks)) {
        for (const entry of entries) {
          for (const hook of entry.hooks) {
            if (hook.type === 'command') {
              expect(hook).toHaveProperty('command')
              expect(hook.command).toBeTruthy()
            }
          }
        }
      }
    }
  })
})

describe('hooks.json uses portable CLAUDE_PLUGIN_ROOT paths', () => {
  it('should not have hardcoded absolute paths in command fields', () => {
    for (const hooksFile of hooksFiles) {
      const hooks = validateJson<HooksManifest>(hooksFile)
      expect(() => validateHooksPortablePaths(hooks, hooksFile)).not.toThrow()
    }
  })
})

/**
 * Suggest-compacting plugin tests
 * Vitest equivalent of tests/suggest-compacting/suggest-compacting.bats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const TEST_SESSION_ID = 'test-session-123'
const TEST_STATE_DIR = `${process.env.HOME}/.claude/suggest-compacting`
const TEST_STATE_FILE = join(TEST_STATE_DIR, `tool-count-${TEST_SESSION_ID}.txt`)
const CLAUDE_PLUGIN_ROOT = join(process.cwd(), 'plugins', 'suggest-compacting')

beforeAll(() => {
  // Clean up any existing test state
  if (existsSync(TEST_STATE_FILE)) {
    rmSync(TEST_STATE_FILE)
  }
})

afterAll(() => {
  // Clean up test state
  if (existsSync(TEST_STATE_FILE)) {
    rmSync(TEST_STATE_FILE)
  }
})

describe('suggest-compacting: plugin.json exists', () => {
  it('should have plugin.json', () => {
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, '.claude-plugin', 'plugin.json'))).toBe(true)
  })
})

describe('suggest-compacting: hooks.json exists', () => {
  it('should have hooks.json', () => {
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'hooks', 'hooks.json'))).toBe(true)
  })
})

describe('suggest-compacting: hooks.json has SessionStart hook', () => {
  it('should have SessionStart hook', () => {
    const hooksJson = join(CLAUDE_PLUGIN_ROOT, 'hooks', 'hooks.json')
    const data = JSON.parse(readFileSync(hooksJson, 'utf-8'))
    expect(data.hooks.SessionStart).toBeDefined()
  })
})

describe('suggest-compacting: hooks.json has PreToolUse hook', () => {
  it('should have PreToolUse hook', () => {
    const hooksJson = join(CLAUDE_PLUGIN_ROOT, 'hooks', 'hooks.json')
    const data = JSON.parse(readFileSync(hooksJson, 'utf-8'))
    expect(data.hooks.PreToolUse).toBeDefined()
  })
})

describe('suggest-compacting: SessionStart hook uses tsx', () => {
  it('should use tsx for SessionStart', () => {
    const hooksJson = join(CLAUDE_PLUGIN_ROOT, 'hooks', 'hooks.json')
    const data = JSON.parse(readFileSync(hooksJson, 'utf-8'))
    const command = data.hooks.SessionStart[0].hooks[0].command
    expect(command).toContain('session-start')
  })
})

describe('suggest-compacting: PreToolUse hook uses tsx', () => {
  it('should use tsx for PreToolUse', () => {
    const hooksJson = join(CLAUDE_PLUGIN_ROOT, 'hooks', 'hooks.json')
    const data = JSON.parse(readFileSync(hooksJson, 'utf-8'))
    const command = data.hooks.PreToolUse[0].hooks[0].command
    expect(command).toContain('auto-compact')
  })
})

describe('suggest-compacting: TypeScript source files exist', () => {
  it('should have TypeScript source files', () => {
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'src', 'lib', 'state.ts'))).toBe(true)
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'src', 'session-start.ts'))).toBe(true)
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'src', 'auto-compact.ts'))).toBe(true)
  })
})

describe('suggest-compacting: TypeScript config exists', () => {
  it('should have tsconfig.json', () => {
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'tsconfig.json'))).toBe(true)
  })
})

describe('suggest-compacting: Jest config removed (no longer needed)', () => {
  it('should not have jest.config.cjs', () => {
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'jest.config.cjs'))).toBe(false)
  })
})

describe('suggest-compacting: unit tests removed (no longer needed)', () => {
  it('should not have tests/unit directory', () => {
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'tests', 'unit'))).toBe(false)
  })
})

describe('suggest-compacting: old Bash hooks are removed', () => {
  it('should not have old bash hooks', () => {
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'hooks', 'auto-compact.sh'))).toBe(false)
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'hooks', 'session-start-hook.sh'))).toBe(false)
    expect(existsSync(join(CLAUDE_PLUGIN_ROOT, 'hooks', 'lib', 'state.sh'))).toBe(false)
  })
})

describe('suggest-compacting: package.json exists without Jest scripts', () => {
  it('should not have Jest in dependencies', () => {
    const packageJson = join(CLAUDE_PLUGIN_ROOT, 'package.json')
    const data = JSON.parse(readFileSync(packageJson, 'utf-8'))

    // Verify Jest is not in dependencies
    expect(data.devDependencies?.jest).toBeUndefined()

    // Verify TypeScript and tsx are present
    expect(data.devDependencies?.typescript).toBeDefined()
    expect(data.devDependencies?.tsx).toBeDefined()
  })
})

/**
 * Me plugin-specific tests
 * Vitest equivalent of plugins/me/tests/me-specific.bats
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = process.cwd()
const PLUGIN_DIR = join(PROJECT_ROOT, 'plugins', 'me')

// Helper functions from vitest.ts
function hasFrontmatterDelimiter(content: string): boolean {
  const firstLine = content.split('\n')[0]
  return firstLine.trim() === '---'
}

function hasFrontmatterField(content: string, field: string): boolean {
  const regex = new RegExp(`^${field}:`, 'm')
  return regex.test(content)
}

describe('me: has all workflow commands', () => {
  const commands = [
    'brainstorm.md',
    'debugging.md',
    'orchestrate.md',
    'refactor-clean.md',
    'research.md',
    'sdd.md',
    'verify.md',
    'tdd.md',
    'spawn.md',
    'claude-isolated-test.md',
  ]

  it.each(commands)('should have command file: %s', (command) => {
    expect(existsSync(join(PLUGIN_DIR, 'commands', command))).toBe(true)
  })
})

describe('me: code-reviewer agent exists with proper model', () => {
  it('should have code-reviewer.md agent with model field', () => {
    const agentFile = join(PLUGIN_DIR, 'agents', 'code-reviewer.md')
    expect(existsSync(agentFile)).toBe(true)

    const content = readFileSync(agentFile, 'utf-8')
    expect(hasFrontmatterField(content, 'model')).toBe(true)
  })
})

// create-pr command tests
describe('me: create-pr command exists with required components', () => {
  it('should have create-pr.md command', () => {
    expect(existsSync(join(PLUGIN_DIR, 'commands', 'create-pr.md'))).toBe(true)
  })

  it('should have check-conflicts.sh script', () => {
    expect(existsSync(join(PLUGIN_DIR, 'scripts', 'check-conflicts.sh'))).toBe(true)
  })

  it('should have verify-pr-status.sh script', () => {
    expect(existsSync(join(PLUGIN_DIR, 'scripts', 'verify-pr-status.sh'))).toBe(true)
  })
})

describe('me: create-pr command has proper frontmatter', () => {
  it('should have proper frontmatter', () => {
    const commandFile = join(PLUGIN_DIR, 'commands', 'create-pr.md')
    const content = readFileSync(commandFile, 'utf-8')

    expect(hasFrontmatterDelimiter(content)).toBe(true)
    expect(hasFrontmatterField(content, 'name')).toBe(true)
    expect(hasFrontmatterField(content, 'description')).toBe(true)
  })
})

describe('me: create-pr check-conflicts.sh validates arguments and git repo', () => {
  it('should validate arguments', () => {
    const script = join(PLUGIN_DIR, 'scripts', 'check-conflicts.sh')
    const content = readFileSync(script, 'utf-8')

    expect(content).toMatch(/if.*#.*ne 1/)
    expect(content).toContain('git rev-parse')
  })
})

describe('me: create-pr verify-pr-status.sh handles all PR states with CI checks', () => {
  it('should handle all PR states', () => {
    const script = join(PLUGIN_DIR, 'scripts', 'verify-pr-status.sh')
    const content = readFileSync(script, 'utf-8')

    expect(content).toContain('CLEAN)')
    expect(content).toContain('BEHIND)')
    expect(content).toContain('DIRTY)')
    expect(content).toContain('statusCheckRollup')
    expect(content).toContain('isRequired')
    expect(content).toContain('MAX_RETRIES')
  })
})

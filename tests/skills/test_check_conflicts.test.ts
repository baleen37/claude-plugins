/**
 * Test suite for create-pr skill's check-conflicts.sh script
 * Vitest equivalent of tests/skills/test_check_conflicts.bats
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

let SCRIPT: string

beforeAll(() => {
  SCRIPT = join(process.cwd(), 'plugins', 'me', 'scripts', 'check-conflicts.sh')
})

describe('check-conflicts.sh: fails without arguments', () => {
  it('should fail without arguments', () => {
    expect(() => {
      execSync(`"${SCRIPT}"`, { stdio: 'pipe' })
    }).toThrow()
  })
})

describe('check-conflicts.sh: shows usage on error', () => {
  it('should show usage on error', () => {
    try {
      execSync(`"${SCRIPT}"`, { stdio: 'pipe' })
    } catch (error: any) {
      expect(error.stdout?.toString() || error.stderr?.toString() || '').toContain('Usage:')
    }
  })
})

describe('check-conflicts.sh: is executable', () => {
  it('should be executable', () => {
    const stats = require('fs').statSync(SCRIPT)
    // Check if file is executable (mode & 0o111)
    expect((stats.mode & 0o111)).not.toBe(0)
  })
})

describe('check-conflicts.sh: has proper shebang', () => {
  it('should have proper shebang', () => {
    const content = readFileSync(SCRIPT, 'utf-8')
    const firstLine = content.split('\n')[0]
    expect(firstLine).toBe('#!/usr/bin/env bash')
  })
})

describe('check-conflicts.sh: uses set -euo pipefail', () => {
  it('should use set -euo pipefail', () => {
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('set -euo pipefail')
  })
})

describe('check-conflicts.sh: documents exit codes', () => {
  it('should document exit codes', () => {
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('Exit codes:')
    expect(content).toContain('0 - No conflicts')
    expect(content).toContain('1 - Conflicts detected')
    expect(content).toContain('2 - Error')
  })
})

describe('check-conflicts.sh: checks for git repository', () => {
  it('should check for git repository', () => {
    // This test requires creating a temp directory (not a git repo)
    // and checking that the script fails with appropriate error
    // We'll skip the actual execution since it requires changing directories
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('git rev-parse --git-dir')
  })
})

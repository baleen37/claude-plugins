/**
 * Test suite for create-pr skill's verify-pr-status.sh script
 * Vitest equivalent of tests/skills/test_create_pr_verify_status.bats
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

let SCRIPT: string

beforeAll(() => {
  SCRIPT = join(process.cwd(), 'plugins', 'me', 'scripts', 'verify-pr-status.sh')
})

describe('verify-pr-status.sh: Script requires base branch argument', () => {
  it('should require base branch argument', () => {
    if (!existsSync(SCRIPT)) {
      return
    }
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('ERROR: Base branch required')
    expect(content).toContain('Usage:')
  })
})

describe('verify-pr-status.sh: Script is executable', () => {
  it('should be executable', () => {
    if (!existsSync(SCRIPT)) {
      return
    }
    const stats = require('fs').statSync(SCRIPT)
    expect((stats.mode & 0o111)).not.toBe(0)
  })
})

describe('verify-pr-status.sh: Script uses set -euo pipefail', () => {
  it('should use strict error handling', () => {
    if (!existsSync(SCRIPT)) {
      return
    }
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('set -euo pipefail')
  })
})

describe('verify-pr-status.sh: Script exit codes are documented', () => {
  it('should document exit codes', () => {
    if (!existsSync(SCRIPT)) {
      return
    }
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('Exit codes:')
    expect(content).toContain('0 - PR is merge-ready')
    expect(content).toContain('1 - Error')
    expect(content).toContain('2 - Pending')
  })
})

describe('verify-pr-status.sh: Script checks required CI checks', () => {
  it('should check required CI status', () => {
    if (!existsSync(SCRIPT)) {
      return
    }
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('isRequired==true')
  })
})

describe('verify-pr-status.sh: Script handles BEHIND with retry', () => {
  it('should have retry logic for BEHIND', () => {
    if (!existsSync(SCRIPT)) {
      return
    }
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('MAX_RETRIES=3')
    expect(content).toContain('RETRY_COUNT')
  })
})

describe('verify-pr-status.sh: Script lists conflict files', () => {
  it('should list conflict files on DIRTY', () => {
    if (!existsSync(SCRIPT)) {
      return
    }
    const content = readFileSync(SCRIPT, 'utf-8')
    expect(content).toContain('git diff --name-only --diff-filter=U')
  })
})

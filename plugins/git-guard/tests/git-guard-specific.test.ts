/**
 * Git Guard plugin-specific tests
 * Vitest equivalent of plugins/git-guard/tests/git-guard-specific.bats
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const PLUGIN_DIR = join(process.cwd(), 'plugins', 'git-guard')

describe('git-guard: commit-guard.sh hook script exists', () => {
  it('should have commit-guard.sh script', () => {
    expect(existsSync(join(PLUGIN_DIR, 'hooks', 'commit-guard.sh'))).toBe(true)
  })
})

describe('git-guard: pre-commit-guard.sh hook script exists', () => {
  it('should have pre-commit-guard.sh script', () => {
    expect(existsSync(join(PLUGIN_DIR, 'hooks', 'pre-commit-guard.sh'))).toBe(true)
  })
})

describe('git-guard: hook scripts use proper error handling', () => {
  it('should use set -euo pipefail in commit-guard.sh', () => {
    const content = readFileSync(join(PLUGIN_DIR, 'hooks', 'commit-guard.sh'), 'utf-8')
    expect(content).toContain('set -euo pipefail')
  })

  it('should use set -euo pipefail in pre-commit-guard.sh', () => {
    const content = readFileSync(join(PLUGIN_DIR, 'hooks', 'pre-commit-guard.sh'), 'utf-8')
    expect(content).toContain('set -euo pipefail')
  })
})

describe('git-guard: hooks.json references hook scripts', () => {
  it('should reference hook scripts in hooks.json', () => {
    const hooksJson = join(PLUGIN_DIR, 'hooks', 'hooks.json')
    const content = readFileSync(hooksJson, 'utf-8')
    const hasCommitGuard = content.includes('commit-guard.sh')
    const hasPreCommitGuard = content.includes('pre-commit-guard.sh')
    expect(hasCommitGuard || hasPreCommitGuard).toBe(true)
  })
})

// commit-guard.sh functional tests
describe('git-guard: commit-guard blocks --no-verify', () => {
  it('should block --no-verify flag', () => {
    const script = join(PLUGIN_DIR, 'hooks', 'commit-guard.sh')
    const input = '{"command":"git commit --no-verify -m \\"test\\""}'

    expect(() => {
      execSync(`echo '${input}' | '${script}'`, { stdio: 'pipe' })
    }).toThrow()
  })
})

describe('git-guard: commit-guard blocks --no-verify with amend', () => {
  it('should block --no-verify --amend', () => {
    const script = join(PLUGIN_DIR, 'hooks', 'commit-guard.sh')
    const input = '{"command":"git commit --amend --no-verify"}'

    expect(() => {
      execSync(`echo '${input}' | '${script}'`, { stdio: 'pipe' })
    }).toThrow()
  })
})

describe('git-guard: commit-guard allows normal git commit', () => {
  it('should allow normal commit', () => {
    const script = join(PLUGIN_DIR, 'hooks', 'commit-guard.sh')
    const input = '{"command":"git commit -m \\"normal commit\\""}'

    expect(() => {
      execSync(`echo '${input}' | '${script}'`, { stdio: 'pipe' })
    }).not.toThrow()
  })
})

describe('git-guard: commit-guard blocks Co-Authored-By in commit message', () => {
  it('should block Co-Authored-By', () => {
    const script = join(PLUGIN_DIR, 'hooks', 'commit-guard.sh')
    const input = '{"command":"git commit -m \\"test message\\n\\n-Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\\""}'

    expect(() => {
      execSync(`echo '${input}' | '${script}'`, { stdio: 'pipe' })
    }).toThrow()
  })
})

describe('git-guard: commit-guard allows commit without Co-Authored-By', () => {
  it('should allow commit without Co-Authored-By', () => {
    const script = join(PLUGIN_DIR, 'hooks', 'commit-guard.sh')
    const input = '{"command":"git commit -m \\"normal commit message\\""}'

    expect(() => {
      execSync(`echo '${input}' | '${script}'`, { stdio: 'pipe' })
    }).not.toThrow()
  })
})

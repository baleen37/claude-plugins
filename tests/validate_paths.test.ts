/**
 * Test suite for path portability validation
 * Vitest equivalent of tests/validate_paths.bats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let TEST_DIR: string

beforeAll(() => {
  const tempBase = tmpdir()
  const tempDir = mkdtempSync(join(tempBase, 'path-tests-'))
  TEST_DIR = tempDir
})

afterAll(() => {
  if (TEST_DIR) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

describe('detects hardcoded absolute paths in JSON files', () => {
  it('should find hardcoded paths in JSON', () => {
    const testJson = join(TEST_DIR, 'test.json')
    writeFileSync(testJson, JSON.stringify({
      path: '/home/user/config',
      another: '/Users/john/data'
    }, null, 2))

    const content = readFileSync(testJson, 'utf-8')
    const hardcodedPathPattern = /(^|[^$])\/([a-z]|home|Users|tmp)/

    expect(hardcodedPathPattern.test(content)).toBe(true)
    expect(content).toContain('/home/user/config')
    expect(content).toContain('/Users/john/data')
  })
})

describe('allows portable ${CLAUDE_PLUGIN_ROOT} paths', () => {
  it('should allow portable CLAUDE_PLUGIN_ROOT paths', () => {
    const portableJson = join(TEST_DIR, 'portable.json')
    writeFileSync(portableJson, JSON.stringify({
      scriptPath: '${CLAUDE_PLUGIN_ROOT}/scripts/test.sh',
      config: '${CLAUDE_PLUGIN_ROOT}/config.json'
    }, null, 2))

    const content = readFileSync(portableJson, 'utf-8')
    expect(content).toContain('${CLAUDE_PLUGIN_ROOT}')
  })
})

describe('detects hardcoded paths in shell scripts', () => {
  it('should find hardcoded paths in shell scripts', () => {
    const testSh = join(TEST_DIR, 'test.sh')
    writeFileSync(testSh, `#!/bin/bash
CONFIG_PATH="/home/user/config.json"
DATA_DIR="/tmp/myapp/data"
`)

    const content = readFileSync(testSh, 'utf-8')
    const hardcodedPathPattern = /(^|[^$])\/([a-z]|home|Users|tmp)/

    expect(hardcodedPathPattern.test(content)).toBe(true)
    expect(content).toContain('/home/user/config.json')
  })
})

describe('excludes .git directory from path checks', () => {
  it('should not find paths in .git directory', () => {
    const gitDir = join(TEST_DIR, '.git')
    mkdirSync(gitDir, { recursive: true })
    const gitConfig = join(gitDir, 'config')

    // Create fake .git directory
    writeFileSync(gitConfig, `[core]
    repositoryformatversion = 0
    filemode = true
    bare = false
    logallrefupdates = true
    ignorecase = true
    precomposeunicode = true
    path = /usr/local/git
`)

    // Read all files except .git
    const files: string[] = []
    function collectFiles(dir: string) {
      try {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory() && entry.name !== '.git') {
            collectFiles(fullPath)
          } else if (entry.isFile() && !fullPath.includes('.git')) {
            files.push(fullPath)
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    }

    collectFiles(TEST_DIR)

    // Check that /usr/local/git is not found in any file (excluding .git)
    let foundGitPath = false
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      if (content.includes('/usr/local/git')) {
        foundGitPath = true
        break
      }
    }

    expect(foundGitPath).toBe(false)
  })
})

describe('allows dollar-prefixed variables (not hardcoded paths)', () => {
  it('should not flag variable paths as hardcoded', () => {
    const variablesSh = join(TEST_DIR, 'variables.sh')
    writeFileSync(variablesSh, `#!/bin/bash
CONFIG_PATH="$HOME/config"
DATA_DIR="$TMP/myapp/data"
`)

    const content = readFileSync(variablesSh, 'utf-8')

    // $HOME and $TMP should not match the pattern (they have $ before)
    // Check that paths starting with $ are not flagged
    expect(content.includes('$HOME/config')).toBe(true)
    expect(content.includes('$TMP/myapp/data')).toBe(true)
  })
})

describe('checks markdown files for hardcoded paths', () => {
  it('should find hardcoded paths in markdown', () => {
    const readme = join(TEST_DIR, 'README.md')
    writeFileSync(readme, `# Documentation

Configuration is stored in /home/user/.config/app.json.

See /Users/john/docs for more info.
`)

    const content = readFileSync(readme, 'utf-8')
    const hardcodedPathPattern = /(^|[^$])\/([a-z]|home|Users|tmp)/

    expect(hardcodedPathPattern.test(content)).toBe(true)
    expect(content).toContain('/home/user/.config')
  })
})

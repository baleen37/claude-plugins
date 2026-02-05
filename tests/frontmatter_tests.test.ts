/**
 * Test: Component files have valid frontmatter
 * Vitest equivalent of tests/frontmatter_tests.bats
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import { hasFrontmatterDelimiter, PROJECT_ROOT } from './helpers/vitest'

// Helper function to recursively find files matching a pattern
function findFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = []

  function traverse(currentPath: string) {
    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name)

        if (entry.isDirectory()) {
          traverse(fullPath)
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Directory might not be accessible
    }
  }

  traverse(dir)
  return files
}

describe('Command files exist in plugins', () => {
  it('should find at least one command file', () => {
    const commandFiles = findFiles(join(PROJECT_ROOT, 'plugins'), /\.md$/)
    const commandsDirFiles = commandFiles.filter((f) => f.includes('/commands/'))
    expect(commandsDirFiles.length).toBeGreaterThan(0)
  })
})

describe('Command files have frontmatter delimiter', () => {
  it('should have valid frontmatter delimiter for all command files', () => {
    const commandFiles = findFiles(join(PROJECT_ROOT, 'plugins'), /\.md$/)
    const commandsDirFiles = commandFiles.filter((f) => f.includes('/commands/'))

    for (const file of commandsDirFiles) {
      // Skip CLAUDE.md files (documentation, not commands)
      if (file.endsWith('/CLAUDE.md')) {
        continue
      }

      const content = readFileSync(file, 'utf-8')
      expect(hasFrontmatterDelimiter(content)).toBe(true)
    }
  })
})

describe('Agent files exist in plugins', () => {
  it('should find at least one agent file', () => {
    const agentFiles = findFiles(join(PROJECT_ROOT, 'plugins'), /\.md$/)
    const agentsDirFiles = agentFiles.filter((f) => f.includes('/agents/'))
    expect(agentsDirFiles.length).toBeGreaterThan(0)
  })
})

describe('Agent files have frontmatter delimiter', () => {
  it('should have valid frontmatter delimiter for all agent files', () => {
    const agentFiles = findFiles(join(PROJECT_ROOT, 'plugins'), /\.md$/)
    const agentsDirFiles = agentFiles.filter((f) => f.includes('/agents/'))

    for (const file of agentsDirFiles) {
      // Skip CLAUDE.md files (documentation, not agents)
      if (file.endsWith('/CLAUDE.md')) {
        continue
      }

      const content = readFileSync(file, 'utf-8')
      expect(hasFrontmatterDelimiter(content)).toBe(true)
    }
  })
})

describe('SKILL.md files exist', () => {
  it('should find at least one SKILL.md file', () => {
    const skillFiles = findFiles(PROJECT_ROOT, /^SKILL\.md$/)
    expect(skillFiles.length).toBeGreaterThan(0)
  })
})

describe('SKILL.md files have valid frontmatter delimiter', () => {
  it('should have valid frontmatter delimiter for all SKILL.md files', () => {
    const skillFiles = findFiles(PROJECT_ROOT, /^SKILL\.md$/)

    for (const file of skillFiles) {
      const content = readFileSync(file, 'utf-8')
      expect(hasFrontmatterDelimiter(content)).toBe(true)
    }
  })
})

describe('SKILL.md files have name field', () => {
  it('should have name field in frontmatter for all SKILL.md files', () => {
    const skillFiles = findFiles(PROJECT_ROOT, /^SKILL\.md$/)

    for (const file of skillFiles) {
      const content = readFileSync(file, 'utf-8')
      const { data } = matter(content)
      expect(data).toHaveProperty('name')
    }
  })
})

describe('SKILL.md files have description field', () => {
  it('should have description field in frontmatter for all SKILL.md files', () => {
    const skillFiles = findFiles(PROJECT_ROOT, /^SKILL\.md$/)

    for (const file of skillFiles) {
      const content = readFileSync(file, 'utf-8')
      const { data } = matter(content)
      expect(data).toHaveProperty('description')
    }
  })
})

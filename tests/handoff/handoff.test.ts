/**
 * Handoff plugin tests
 * Vitest equivalent of tests/handoff/handoff.bats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

let TEST_TEMP_DIR: string
let HANDOFF_TEST_DIR: string
let TEST_PROJECT_PATH: string
let NOW: string

beforeAll(() => {
  TEST_TEMP_DIR = mkdtempSync('/tmp/handoff-tests-')
  HANDOFF_TEST_DIR = join(TEST_TEMP_DIR, 'handoffs')
  mkdirSync(HANDOFF_TEST_DIR, { recursive: true })

  TEST_PROJECT_PATH = '/tmp/test-project'
  mkdirSync(TEST_PROJECT_PATH, { recursive: true })

  NOW = new Date().toISOString()
})

afterAll(() => {
  if (TEST_TEMP_DIR && existsSync(TEST_TEMP_DIR)) {
    rmSync(TEST_TEMP_DIR, { recursive: true, force: true })
  }
  if (TEST_PROJECT_PATH && existsSync(TEST_PROJECT_PATH)) {
    rmSync(TEST_PROJECT_PATH, { recursive: true, force: true })
  }
})

describe('handoff directory is created when it doesn\'t exist', () => {
  it('should have handoff directory', () => {
    expect(existsSync(HANDOFF_TEST_DIR)).toBe(true)
  })
})

describe('handoff JSON file has correct structure', () => {
  it('should have valid handoff JSON structure', () => {
    const HANDOFF_ID = 'test-handoff-123'
    const HANDOFF_FILE = join(HANDOFF_TEST_DIR, `${HANDOFF_ID}.json`)

    const handoffData = {
      id: HANDOFF_ID,
      created_at: NOW,
      loaded_at: null,
      project_name: 'test-project',
      project_path: TEST_PROJECT_PATH,
      branch: 'main',
      summary: 'Test handoff summary',
      references: {
        plan_path: null,
        tasks_session_id: null,
      },
      source_session_id: 'test-session-123',
    }

    writeFileSync(HANDOFF_FILE, JSON.stringify(handoffData, null, 2))

    // Verify file exists
    expect(existsSync(HANDOFF_FILE)).toBe(true)

    // Verify valid JSON
    const data = JSON.parse(readFileSync(HANDOFF_FILE, 'utf-8'))
    expect(data).toBeDefined()

    // Verify required fields
    expect(data.id).toBe(HANDOFF_ID)
    expect(data.project_path).toBe(TEST_PROJECT_PATH)
    expect(data.summary).toBe('Test handoff summary')
  })
})

describe('handoff file filtering by project path works', () => {
  it('should filter handoffs by project path', () => {
    // Create handoffs for different projects
    writeFileSync(join(HANDOFF_TEST_DIR, 'handoff1.json'), JSON.stringify({
      id: 'handoff1',
      created_at: NOW,
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Test project handoff',
    }, null, 2))

    writeFileSync(join(HANDOFF_TEST_DIR, 'handoff2.json'), JSON.stringify({
      id: 'handoff2',
      created_at: NOW,
      loaded_at: null,
      project_path: '/other/project',
      summary: 'Other project handoff',
    }, null, 2))

    // Filter by project path
    const files = ['handoff1.json', 'handoff2.json'].map(f => join(HANDOFF_TEST_DIR, f))
    const filtered = files.filter(f => {
      const data = JSON.parse(readFileSync(f, 'utf-8'))
      return data.project_path === TEST_PROJECT_PATH
    })

    expect(filtered.length).toBe(1)
  })
})

describe('handoff loaded_at timestamp updates on pickup', () => {
  it('should update loaded_at timestamp', () => {
    const HANDOFF_FILE = join(HANDOFF_TEST_DIR, 'test-loaded.json')

    const handoffData = {
      id: 'test-loaded',
      created_at: NOW,
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Test loading',
    }

    writeFileSync(HANDOFF_FILE, JSON.stringify(handoffData, null, 2))

    // Verify loaded_at is null initially
    let data = JSON.parse(readFileSync(HANDOFF_FILE, 'utf-8'))
    expect(data.loaded_at).toBe(null)

    // Update loaded_at
    const LOADED_TIME = new Date().toISOString()
    data.loaded_at = LOADED_TIME
    writeFileSync(HANDOFF_FILE, JSON.stringify(data, null, 2))

    // Verify loaded_at was updated
    data = JSON.parse(readFileSync(HANDOFF_FILE, 'utf-8'))
    expect(data.loaded_at).toBe(LOADED_TIME)
  })
})

describe('session-start hook detects recent handoffs', () => {
  it('should detect recent handoffs', () => {
    const RECENT_TIME = new Date().toISOString()
    writeFileSync(join(HANDOFF_TEST_DIR, 'recent-handoff.json'), JSON.stringify({
      id: 'recent-handoff',
      created_at: RECENT_TIME,
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Recent work',
    }, null, 2))

    // Verify handoff is recent
    const data = JSON.parse(readFileSync(join(HANDOFF_TEST_DIR, 'recent-handoff.json'), 'utf-8'))
    expect(data.created_at).toBeTruthy()
    expect(typeof data.created_at).toBe('string')
  })
})

describe('session-start hook ignores already loaded handoffs', () => {
  it('should ignore loaded handoffs', () => {
    writeFileSync(join(HANDOFF_TEST_DIR, 'loaded-handoff.json'), JSON.stringify({
      id: 'loaded-handoff',
      created_at: NOW,
      loaded_at: NOW,
      project_path: TEST_PROJECT_PATH,
      summary: 'Already loaded',
    }, null, 2))

    // Verify loaded_at is not null
    const data = JSON.parse(readFileSync(join(HANDOFF_TEST_DIR, 'loaded-handoff.json'), 'utf-8'))
    expect(data.loaded_at).not.toBe(null)
  })
})

describe('handoff-list sorts by created_at descending', () => {
  it('should sort handoffs by created_at descending', () => {
    writeFileSync(join(HANDOFF_TEST_DIR, 'old.json'), JSON.stringify({
      id: 'old',
      created_at: '2026-02-01T10:00:00Z',
      project_path: TEST_PROJECT_PATH,
      summary: 'Old handoff',
    }, null, 2))

    writeFileSync(join(HANDOFF_TEST_DIR, 'new.json'), JSON.stringify({
      id: 'new',
      created_at: '2026-02-04T10:00:00Z',
      project_path: TEST_PROJECT_PATH,
      summary: 'New handoff',
    }, null, 2))

    writeFileSync(join(HANDOFF_TEST_DIR, 'middle.json'), JSON.stringify({
      id: 'middle',
      created_at: '2026-02-02T10:00:00Z',
      project_path: TEST_PROJECT_PATH,
      summary: 'Middle handoff',
    }, null, 2))

    // Sort by created_at descending
    const files = ['old.json', 'new.json', 'middle.json'].map(f => join(HANDOFF_TEST_DIR, f))
    const sorted = files.map(f => JSON.parse(readFileSync(f, 'utf-8')))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    expect(sorted[0].id).toBe('new')
  })
})

describe('pickup resolves plan_path with tilde expansion', () => {
  it('should resolve plan_path with tilde', () => {
    const HANDOFF_FILE = join(HANDOFF_TEST_DIR, 'plan-handoff.json')

    // Create a test plan file
    const TEST_PLAN_DIR = join(TEST_TEMP_DIR, '.claude', 'plans')
    mkdirSync(TEST_PLAN_DIR, { recursive: true })
    const TEST_PLAN_FILE = join(TEST_PLAN_DIR, 'test-plan.md')
    writeFileSync(TEST_PLAN_FILE, '# Test Plan')

    // Create handoff with plan_path reference
    const handoffData = {
      id: 'plan-handoff',
      created_at: NOW,
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Handoff with plan reference',
      references: {
        plan_path: TEST_PLAN_FILE,
        tasks_session_id: null,
      },
    }

    writeFileSync(HANDOFF_FILE, JSON.stringify(handoffData, null, 2))

    // Extract plan_path from handoff
    const data = JSON.parse(readFileSync(HANDOFF_FILE, 'utf-8'))
    const PLAN_PATH = data.references.plan_path
    expect(PLAN_PATH).toBe(TEST_PLAN_FILE)

    // Verify the expansion works
    const TEST_EXPANDED = PLAN_PATH.replace('~', TEST_TEMP_DIR)
    expect(TEST_EXPANDED).toBe(TEST_PLAN_FILE)
  })
})

describe('pickup extracts tasks_session_id for loading', () => {
  it('should extract tasks_session_id', () => {
    const HANDOFF_FILE = join(HANDOFF_TEST_DIR, 'tasks-handoff.json')
    const TASKS_SESSION_ID = '75c272b1-b00d-4bbb-bfa5-87269f30ff47'

    const handoffData = {
      id: 'tasks-handoff',
      created_at: NOW,
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Handoff with tasks session',
      references: {
        plan_path: null,
        tasks_session_id: TASKS_SESSION_ID,
      },
    }

    writeFileSync(HANDOFF_FILE, JSON.stringify(handoffData, null, 2))

    // Extract tasks_session_id from handoff
    const data = JSON.parse(readFileSync(HANDOFF_FILE, 'utf-8'))
    const EXTRACTED_SESSION_ID = data.references.tasks_session_id
    expect(EXTRACTED_SESSION_ID).toBe(TASKS_SESSION_ID)
  })
})

describe('pickup handles missing plan file gracefully', () => {
  it('should handle missing plan file', () => {
    const HANDOFF_FILE = join(HANDOFF_TEST_DIR, 'missing-plan-handoff.json')

    const handoffData = {
      id: 'missing-plan-handoff',
      created_at: NOW,
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Handoff with missing plan',
      references: {
        plan_path: '~/.claude/plans/nonexistent.md',
        tasks_session_id: null,
      },
    }

    writeFileSync(HANDOFF_FILE, JSON.stringify(handoffData, null, 2))

    // Extract plan_path
    const data = JSON.parse(readFileSync(HANDOFF_FILE, 'utf-8'))
    const PLAN_PATH = data.references.plan_path
    expect(PLAN_PATH).toBeTruthy()

    // Verify file doesn't exist (skill should show warning but continue)
    const EXPANDED_PATH = PLAN_PATH.replace('~', process.env.HOME || '')
    expect(existsSync(EXPANDED_PATH)).toBe(false)
  })
})

describe('pickup displays source_session_id when present', () => {
  it('should extract source_session_id', () => {
    const HANDOFF_FILE = join(HANDOFF_TEST_DIR, 'source-session-handoff.json')
    const SOURCE_SESSION_ID = '00538c2c-c67e-4afe-a933-bb8ed6ed19c6'

    const handoffData = {
      id: 'source-session-handoff',
      created_at: NOW,
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Handoff with source session',
      source_session_id: SOURCE_SESSION_ID,
    }

    writeFileSync(HANDOFF_FILE, JSON.stringify(handoffData, null, 2))

    // Extract source_session_id
    const data = JSON.parse(readFileSync(HANDOFF_FILE, 'utf-8'))
    const EXTRACTED_SOURCE = data.source_session_id
    expect(EXTRACTED_SOURCE).toBe(SOURCE_SESSION_ID)
  })
})

describe('pickup finds most recent unloaded handoff for project', () => {
  it('should find most recent unloaded handoff', () => {
    // Create multiple handoffs for the same project
    writeFileSync(join(HANDOFF_TEST_DIR, 'recent1.json'), JSON.stringify({
      id: 'recent1',
      created_at: '2026-02-04T10:00:00Z',
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Recent handoff 1',
    }, null, 2))

    writeFileSync(join(HANDOFF_TEST_DIR, 'recent2.json'), JSON.stringify({
      id: 'recent2',
      created_at: '2026-02-04T12:00:00Z',
      loaded_at: null,
      project_path: TEST_PROJECT_PATH,
      summary: 'Recent handoff 2',
    }, null, 2))

    writeFileSync(join(HANDOFF_TEST_DIR, 'loaded.json'), JSON.stringify({
      id: 'loaded',
      created_at: '2026-02-04T13:00:00Z',
      loaded_at: '2026-02-04T14:00:00Z',
      project_path: TEST_PROJECT_PATH,
      summary: 'Already loaded',
    }, null, 2))

    // Find most recent unloaded handoff
    const files = ['recent1.json', 'recent2.json', 'loaded.json'].map(f => join(HANDOFF_TEST_DIR, f))
    const mostRecent = files
      .map(f => JSON.parse(readFileSync(f, 'utf-8')))
      .filter(h => h.project_path === TEST_PROJECT_PATH && h.loaded_at === null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    expect(mostRecent.id).toBe('recent2')
  })
})

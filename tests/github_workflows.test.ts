/**
 * Test: GitHub Actions workflows configuration
 * Vitest equivalent of tests/github_workflows.bats
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'
import { PROJECT_ROOT, WORKFLOW_DIR } from './helpers/vitest'

const CI_WORKFLOW = join(WORKFLOW_DIR, 'ci.yml')
const RELEASE_WORKFLOW = join(WORKFLOW_DIR, 'release.yml')
const SYNC_WORKFLOW = join(WORKFLOW_DIR, 'sync-marketplace.yml')

// Helper: Parse YAML file
function parseYaml(file: string): unknown {
  const content = readFileSync(file, 'utf-8')
  return YAML.parse(content)
}

// Helper: Get nested value from object
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }

  return current
}

// Helper: Check if workflow has specific trigger
function workflowHasTrigger(workflow: unknown, triggerType: string): boolean {
  const on = getNestedValue(workflow, 'on')
  return on && typeof on === 'object' && triggerType in on
}

// Helper: Check if job has 'if' condition
function jobHasIfCondition(workflow: unknown, jobName: string): boolean {
  return getNestedValue(workflow, `jobs.${jobName}.if`) !== undefined
}

describe('Workflow directory exists', () => {
  it('should have workflows directory', () => {
    expect(existsSync(WORKFLOW_DIR)).toBe(true)
  })
})

describe('CI workflow file exists', () => {
  it('should have CI workflow file', () => {
    expect(existsSync(CI_WORKFLOW)).toBe(true)
    const stats = readFileSync(CI_WORKFLOW, 'utf-8')
    expect(stats.length).toBeGreaterThan(0)
  })
})

describe('CI workflow has valid YAML syntax', () => {
  it('should parse CI workflow YAML', () => {
    expect(() => parseYaml(CI_WORKFLOW)).not.toThrow()
  })
})

describe('CI workflow triggers on push to main', () => {
  it('should have push trigger', () => {
    const workflow = parseYaml(CI_WORKFLOW)
    expect(workflowHasTrigger(workflow, 'push')).toBe(true)
  })
})

describe('CI workflow triggers on pull_request', () => {
  it('should have pull_request trigger', () => {
    const workflow = parseYaml(CI_WORKFLOW)
    expect(workflowHasTrigger(workflow, 'pull_request')).toBe(true)
  })
})

describe('CI workflow has only test job (no release job)', () => {
  it('should only have test job', () => {
    const workflow = parseYaml(CI_WORKFLOW) as Record<string, unknown>
    const jobs = getNestedValue(workflow, 'jobs')

    expect(jobs && typeof jobs === 'object').toBe(true)

    const jobKeys = Object.keys(jobs as Record<string, unknown>)
    expect(jobKeys).toEqual(['test'])

    // Verify release job doesn't exist
    const releaseJob = getNestedValue(workflow, 'jobs.release')
    expect(releaseJob).toBeUndefined()
  })
})

describe('CI workflow has read-only permissions', () => {
  it('should have read-only contents permission', () => {
    const workflow = parseYaml(CI_WORKFLOW) as Record<string, unknown>
    const permissions = getNestedValue(workflow, 'permissions.contents')
    expect(permissions).toBe('read')
  })
})

describe('Release workflow exists', () => {
  it('should have release workflow file', () => {
    expect(existsSync(RELEASE_WORKFLOW)).toBe(true)
  })
})

describe('Release workflow has valid YAML syntax', () => {
  it('should parse release workflow YAML', () => {
    expect(() => parseYaml(RELEASE_WORKFLOW)).not.toThrow()
  })
})

describe('Release workflow triggers on push to main', () => {
  it('should have push trigger for main branch', () => {
    const workflow = parseYaml(RELEASE_WORKFLOW) as Record<string, unknown>
    expect(workflowHasTrigger(workflow, 'push')).toBe(true)

    const branches = getNestedValue(workflow, 'on.push.branches')
    expect(branches).toBeDefined()
  })
})

describe('Release workflow has required permissions', () => {
  it('should have write contents permission', () => {
    const workflow = parseYaml(RELEASE_WORKFLOW) as Record<string, unknown>
    const contentsPerm = getNestedValue(workflow, 'permissions.contents')
    expect(contentsPerm).toBe('write')
  })
})

describe('Marketplace sync workflow exists', () => {
  it('should have sync-marketplace workflow file', () => {
    expect(existsSync(SYNC_WORKFLOW)).toBe(true)
  })
})

describe('Marketplace sync workflow has valid YAML syntax', () => {
  it('should parse sync-marketplace workflow YAML', () => {
    expect(() => parseYaml(SYNC_WORKFLOW)).not.toThrow()
  })
})

describe('Release workflow has infinite loop prevention', () => {
  it('should check for bot actor and release commit message', () => {
    const workflow = parseYaml(RELEASE_WORKFLOW) as Record<string, unknown>
    const ifCondition = getNestedValue(workflow, 'jobs.release.if')

    expect(ifCondition).toBeDefined()
    expect(typeof ifCondition === 'string').toBe(true)

    const conditionStr = ifCondition as string
    expect(conditionStr).toContain('[bot]')
    expect(conditionStr).toContain('chore(release):')
  })
})

describe('Release workflow uses full git history', () => {
  it('should fetch full history for semantic-release', () => {
    const workflow = parseYaml(RELEASE_WORKFLOW) as Record<string, unknown>
    const jobs = getNestedValue(workflow, 'jobs') as Record<string, unknown>
    const releaseJob = jobs.release as Record<string, unknown>
    const steps = releaseJob.steps as Array<Record<string, unknown>>

    // Find the checkout step
    const checkoutStep = steps.find((step) => step.uses === 'actions/checkout@v4')

    expect(checkoutStep).toBeDefined()
    expect(checkoutStep?.with).toBeDefined()
    expect((checkoutStep?.with as Record<string, unknown>)['fetch-depth']).toBe(0)
  })
})

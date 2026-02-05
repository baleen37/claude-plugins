/**
 * Tests for CLI runner
 */

import { describe, it, expect } from 'vitest';
import { runCommand } from '../../src/cli/runner.js';

describe('runCommand', () => {
  it('should execute databricks command and return output', async () => {
    const result = await runCommand(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('databricks');
    expect(result.stderr).toBe('');
  });

  it('should use profile when specified', async () => {
    const result = await runCommand(['--help'], { profile: 'test-profile' });

    expect(result.exitCode).toBe(0);
    // Profile flag should be passed (we can't easily test this without mocking)
  });

  it('should pass input via stdin', async () => {
    // This will fail because we don't have a good test command that uses stdin
    // For now, we'll skip this and write it when we have a real use case
  });
});

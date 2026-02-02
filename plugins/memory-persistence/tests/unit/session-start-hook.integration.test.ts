import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// Get the plugin root directory (memory-persistence plugin)
const PLUGIN_ROOT = process.cwd();
const SESSION_START_HOOK_PATH = path.join(PLUGIN_ROOT, 'src', 'hooks', 'session-start.ts');

describe('SessionStart Hook Integration Tests', () => {
  let tempHomeDir: string;
  let projectDir: string;

  beforeEach(async () => {
    // Create temporary home directory structure
    tempHomeDir = path.join('/tmp', `home-test-${Date.now()}`);
    projectDir = path.join(tempHomeDir, '.claude', 'projects', '-Users-test-dev-project-a');
    await fs.mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempHomeDir, { recursive: true, force: true });
    } catch {}
  });

  it('loads from project-specific directory only', async () => {
    // Create two projects
    const projectBDir = path.join(tempHomeDir, '.claude', 'projects', '-Users-test-dev-project-b');
    await fs.mkdir(projectBDir, { recursive: true });

    // Create session files in both projects
    await fs.writeFile(
      path.join(projectDir, 'session-a-123-20260101-120000.md'),
      '# Session A content\n\nThis is from project A.'
    );
    await fs.writeFile(
      path.join(projectBDir, 'session-b-456-20260101-130000.md'),
      '# Session B content\n\nThis is from project B.'
    );

    // Create transcript for project A
    const transcriptPath = path.join(projectDir, 'current-session.jsonl');
    await fs.writeFile(transcriptPath, JSON.stringify({}));

    const input = JSON.stringify({
      session_id: 'current-123',
      transcript_path: transcriptPath
    });

    // Run SessionStart hook for project A
    const output = execSync(
      `echo '${input}' | HOME="${tempHomeDir}" node --import=tsx/esm "${SESSION_START_HOOK_PATH}"`,
      {
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );

    // Verify: Should load project A session
    expect(output).toContain('Session A content');

    // Verify: Should NOT load project B session
    expect(output).not.toContain('Session B content');
  });

  it('finds recent sessions in project directory', async () => {
    // Create multiple session files
    const now = Date.now();
    const session1 = path.join(projectDir, `session-1-001-${new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
    const session2 = path.join(projectDir, `session-2-002-${new Date(now - 10000).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
    const session3 = path.join(projectDir, `session-3-003-${new Date(now - 20000).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);

    await Promise.all([
      fs.writeFile(session1, '# Session 1\n\nContent 1'),
      fs.writeFile(session2, '# Session 2\n\nContent 2'),
      fs.writeFile(session3, '# Session 3\n\nContent 3'),
    ]);

    // Create transcript
    const transcriptPath = path.join(projectDir, 'current.jsonl');
    await fs.writeFile(transcriptPath, JSON.stringify({}));

    const input = JSON.stringify({
      session_id: 'current',
      transcript_path: transcriptPath
    });

    // Run SessionStart hook
    const output = execSync(
      `echo '${input}' | HOME="${tempHomeDir}" node --import=tsx/esm "${SESSION_START_HOOK_PATH}"`,
      {
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );

    // Verify header
    expect(output).toContain('Restored Context from Previous Sessions');

    // Verify sessions are included
    expect(output).toContain('Session 1');
    expect(output).toContain('Session 2');
  });

  it('exits successfully when no previous sessions exist', async () => {
    // Create transcript without any previous sessions
    const transcriptPath = path.join(projectDir, 'current.jsonl');
    await fs.writeFile(transcriptPath, JSON.stringify({}));

    const input = JSON.stringify({
      session_id: 'current',
      transcript_path: transcriptPath
    });

    // Should exit with code 0 (not throw)
    expect(() => {
      const result = execSync(
        `echo '${input}' | HOME="${tempHomeDir}" node --import=tsx/esm "${SESSION_START_HOOK_PATH}"`,
        {
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      );
      expect(result).toBeDefined();
    }).not.toThrow();
  });

  it('exits successfully when session_id is null', () => {
    const input = JSON.stringify({
      session_id: 'null',
      transcript_path: '/some/path.jsonl'
    });

    // Should exit with code 0 (not throw)
    expect(() => {
      const result = execSync(
        `echo '${input}' | node --import=tsx/esm "${SESSION_START_HOOK_PATH}"`,
        {
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      );
      expect(result).toBeDefined();
    }).not.toThrow();
  });

  it('exits successfully when session_id is invalid', () => {
    const input = JSON.stringify({
      session_id: 'invalid session',
      transcript_path: '/some/path.jsonl'
    });

    // Should exit with code 0 (not throw)
    expect(() => {
      const result = execSync(
        `echo '${input}' | node --import=tsx/esm "${SESSION_START_HOOK_PATH}"`,
        {
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      );
      expect(result).toBeDefined();
    }).not.toThrow();
  });
});

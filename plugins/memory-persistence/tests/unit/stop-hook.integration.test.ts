import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// Get the plugin root directory (memory-persistence plugin)
const PLUGIN_ROOT = process.cwd();
const STOP_HOOK_PATH = path.join(PLUGIN_ROOT, 'src', 'hooks', 'stop.ts');

describe('Stop Hook Integration Tests', () => {
  let tempSessionsDir: string;
  let tempTranscriptPath: string;

  beforeEach(async () => {
    // Create temporary directories
    tempSessionsDir = path.join('/tmp', `sessions-test-${Date.now()}`);
    await fs.mkdir(tempSessionsDir, { recursive: true });

    // Create temporary transcript file
    const transcriptDir = path.join('/tmp', `transcript-${Date.now()}`);
    await fs.mkdir(transcriptDir, { recursive: true });
    tempTranscriptPath = path.join(transcriptDir, 'transcript.jsonl');

    // Write mock transcript content (JSONL format)
    const transcriptContent = JSON.stringify({
      role: 'user',
      message: { content: [{ type: 'text', text: 'Hello' }] }
    }) + '\n' +
      JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'Hi there! This is test content.' }] }
      }) + '\n';

    await fs.writeFile(tempTranscriptPath, transcriptContent);
  });

  afterEach(async () => {
    // Cleanup
    try {
      const files = await fs.readdir(tempSessionsDir);
      for (const file of files) {
        await fs.unlink(path.join(tempSessionsDir, file));
      }
      await fs.rmdir(tempSessionsDir);
    } catch {}

    try {
      await fs.unlink(tempTranscriptPath);
      await fs.rmdir(path.dirname(tempTranscriptPath));
    } catch {}

    delete process.env.MEMORY_PERSISTENCE_SESSIONS_DIR;
  });

  it('saves session file from transcript', async () => {
    const input = JSON.stringify({
      session_id: 'test-123',
      transcript_path: tempTranscriptPath
    });

    // Run stop hook with test input
    const result = execSync(
      `echo '${input}' | MEMORY_PERSISTENCE_SESSIONS_DIR="${tempSessionsDir}" node --import=tsx/esm "${STOP_HOOK_PATH}"`,
      {
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );

    // Verify exit code is 0 (success)
    expect(result).toBeDefined();

    // Verify session file was created
    const files = await fs.readdir(tempSessionsDir);
    const sessionFiles = files.filter(f => f.startsWith('session-test-123-') && f.endsWith('.md'));
    expect(sessionFiles.length).toBeGreaterThan(0);

    // Verify session file contains the conversation
    const sessionFile = path.join(tempSessionsDir, sessionFiles[0]);
    const content = await fs.readFile(sessionFile, 'utf-8');
    expect(content).toContain('Hi there! This is test content.');
    expect(content).toContain('Session: test-123');
    expect(content).toContain('Transcript:');
  });

  it('saves to project-specific directory when transcript_path contains project folder', async () => {
    // Create project directory structure
    const projectFolder = '-Users-test-dev-project-a';
    const projectDir = path.join('/tmp', `home-${Date.now()}`, '.claude', 'projects', projectFolder);
    await fs.mkdir(projectDir, { recursive: true });

    const projectTranscriptPath = path.join(projectDir, 'test-session-123.jsonl');
    const transcriptContent = JSON.stringify({
      role: 'user',
      message: { content: [{ type: 'text', text: 'Hello' }] }
    }) + '\n' +
      JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'Project-specific content' }] }
      }) + '\n';

    await fs.writeFile(projectTranscriptPath, transcriptContent);

    const input = JSON.stringify({
      session_id: 'test-123',
      transcript_path: projectTranscriptPath
    });

    // Run stop hook WITHOUT environment variable override
    const tempHome = path.join('/tmp', `home-${Date.now()}`);
    await fs.mkdir(path.join(tempHome, '.claude', 'projects', projectFolder), { recursive: true });

    // Copy transcript to new location
    const newTranscriptPath = path.join(tempHome, '.claude', 'projects', projectFolder, 'test-session-123.jsonl');
    await fs.writeFile(newTranscriptPath, transcriptContent);

    const input2 = JSON.stringify({
      session_id: 'test-123',
      transcript_path: newTranscriptPath
    });

    const result = execSync(
      `echo '${input2}' | HOME="${tempHome}" node --import=tsx/esm "${STOP_HOOK_PATH}"`,
      {
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );

    expect(result).toBeDefined();

    // Verify session file was created in project directory
    const files = await fs.readdir(path.join(tempHome, '.claude', 'projects', projectFolder));
    const sessionFiles = files.filter(f => f.startsWith('session-test-123-') && f.endsWith('.md'));
    expect(sessionFiles.length).toBeGreaterThan(0);

    // Verify content
    const sessionFile = path.join(tempHome, '.claude', 'projects', projectFolder, sessionFiles[0]);
    const content = await fs.readFile(sessionFile, 'utf-8');
    expect(content).toContain('Project-specific content');

    // Cleanup
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it('exits successfully when session_id is null', () => {
    const input = JSON.stringify({
      session_id: 'null',
      transcript_path: tempTranscriptPath
    });

    // Should exit with code 0 (not throw)
    expect(() => {
      execSync(
        `echo '${input}' | node --import=tsx/esm "${STOP_HOOK_PATH}"`,
        {
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      );
    }).not.toThrow();
  });

  it('exits successfully when session_id is invalid', () => {
    const input = JSON.stringify({
      session_id: 'invalid session',
      transcript_path: tempTranscriptPath
    });

    // Should exit with code 0 (not throw)
    expect(() => {
      execSync(
        `echo '${input}' | node --import=tsx/esm "${STOP_HOOK_PATH}"`,
        {
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      );
    }).not.toThrow();
  });
});

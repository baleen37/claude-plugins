import fs from 'fs/promises';
import path from 'path';
import {
  isValidSessionId,
  getSessionsDir,
  extractProjectFolderFromTranscript,
  getSessionsDirForProject,
  saveSessionFile,
  findRecentSessions,
  extractAssistantMessageFromTranscript,
} from '../../src/hooks/lib/state';

const TEST_STATE_DIR = path.join(process.env.HOME || '', '.claude', 'sessions');
const TEST_PROJECT_DIR = path.join(process.env.HOME || '', '.claude', 'projects', 'test-project');

describe('isValidSessionId', () => {
  it('유효한 세션 ID를 허용한다', () => {
    expect(isValidSessionId('abc123')).toBe(true);
    expect(isValidSessionId('session-id_123')).toBe(true);
  });

  it('유효하지 않은 세션 ID를 거부한다', () => {
    expect(isValidSessionId('session id')).toBe(false);
    expect(isValidSessionId('session/id')).toBe(false);
    expect(isValidSessionId('../etc')).toBe(false);
  });
});

describe('getSessionsDir', () => {
  it('기본 세션 디렉토리를 반환한다', () => {
    const dir = getSessionsDir();
    expect(dir).toContain('.claude');
    expect(dir).toContain('sessions');
  });

  it('환경 변수가 설정된 경우 해당 디렉토리를 반환한다', () => {
    const customDir = '/tmp/test-sessions';
    process.env.MEMORY_PERSISTENCE_SESSIONS_DIR = customDir;
    const dir = getSessionsDir();
    expect(dir).toBe(customDir);
    delete process.env.MEMORY_PERSISTENCE_SESSIONS_DIR;
  });
});

describe('extractProjectFolderFromTranscript', () => {
  it('transcript_path에서 프로젝트 폴더를 추출한다', () => {
    const transcriptPath = '/home/user/project/.claude/projects/-Users-test-dev-project/transcript.jsonl';
    const folder = extractProjectFolderFromTranscript(transcriptPath);
    expect(folder).toBe('-Users-test-dev-project');
  });

  it('유효하지 않은 경로에 대해 빈 문자열을 반환한다', () => {
    expect(extractProjectFolderFromTranscript('')).toBe('');
    expect(extractProjectFolderFromTranscript('null')).toBe('');
    expect(extractProjectFolderFromTranscript('/path/without/.claude/projects')).toBe('');
  });
});

describe('getSessionsDirForProject', () => {
  afterEach(() => {
    delete process.env.MEMORY_PERSISTENCE_SESSIONS_DIR;
  });

  it('환경 변수가 우선순위 1이다', () => {
    const customDir = '/tmp/custom-sessions';
    process.env.MEMORY_PERSISTENCE_SESSIONS_DIR = customDir;
    const dir = getSessionsDirForProject('/some/path/.claude/projects/test-project/transcript.jsonl');
    expect(dir).toBe(customDir);
  });

  it('프로젝트별 디렉토리가 우선순위 2이다', () => {
    const dir = getSessionsDirForProject('/home/user/.claude/projects/my-project/transcript.jsonl');
    expect(dir).toContain('.claude');
    expect(dir).toContain('projects');
    expect(dir).toContain('my-project');
  });

  it('프로젝트 폴더가 없으면 기본 디렉토리를 반환한다', () => {
    const dir = getSessionsDirForProject('/some/random/path.jsonl');
    expect(dir).toContain('.claude');
    expect(dir).toContain('sessions');
  });
});

describe('saveSessionFile', () => {
  const testSessionId = 'test-session-save';
  const testContent = '# Test Session\n\nTest content';

  afterEach(async () => {
    try {
      await fs.unlink(path.join(TEST_STATE_DIR, `session-${testSessionId}-*.md`));
    } catch {}
  });

  it('세션 파일을 저장하고 경로를 반환한다', async () => {
    const sessionFile = await saveSessionFile(testSessionId, testContent);
    expect(sessionFile).not.toBeNull();
    expect(sessionFile).toContain(testSessionId);
    expect(sessionFile).toContain('.md');

    // Verify file content
    const content = await fs.readFile(sessionFile!, 'utf-8');
    expect(content).toContain('Test Session');
  });

  it('프로젝트별 디렉토리에 세션 파일을 저장한다', async () => {
    const transcriptPath = '/home/user/.claude/projects/test-project/transcript.jsonl';
    const sessionFile = await saveSessionFile(testSessionId, testContent, transcriptPath);

    expect(sessionFile).not.toBeNull();
    expect(sessionFile).toContain('projects');
    expect(sessionFile).toContain('test-project');
  });
});

describe('findRecentSessions', () => {
  const testBaseName = 'test-session-recent';

  beforeAll(async () => {
    await fs.mkdir(TEST_STATE_DIR, { recursive: true });
  });

  afterAll(async () => {
    const files = await fs.readdir(TEST_STATE_DIR);
    for (const file of files) {
      if (file.startsWith('session-') && file.includes(testBaseName)) {
        await fs.unlink(path.join(TEST_STATE_DIR, file));
      }
    }
  });

  it('최근 세션 파일들을 반환한다', async () => {
    // Create test session files
    const timestamp1 = new Date();
    const timestamp2 = new Date(timestamp1.getTime() - 1000);
    const timestamp3 = new Date(timestamp2.getTime() - 1000);

    const formatTimestamp = (ts: Date) =>
      ts.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const file1 = path.join(TEST_STATE_DIR, `session-${testBaseName}-1-${formatTimestamp(timestamp1)}.md`);
    const file2 = path.join(TEST_STATE_DIR, `session-${testBaseName}-2-${formatTimestamp(timestamp2)}.md`);
    const file3 = path.join(TEST_STATE_DIR, `session-${testBaseName}-3-${formatTimestamp(timestamp3)}.md`);

    await Promise.all([
      fs.writeFile(file1, '# Session 1'),
      fs.writeFile(file2, '# Session 2'),
      fs.writeFile(file3, '# Session 3'),
    ]);

    const recentSessions = await findRecentSessions(2);
    const filteredSessions = recentSessions.filter(s => s.includes(testBaseName));

    expect(filteredSessions.length).toBe(2);
    expect(filteredSessions[0]).toContain(`${testBaseName}-1`); // Newest first
    expect(filteredSessions[1]).toContain(`${testBaseName}-2`);
  });

  it('존재하지 않는 디렉토리에 대해 빈 배열을 반환한다', async () => {
    const sessions = await findRecentSessions(5, '/nonexistent/.claude/projects/test/transcript.jsonl');
    expect(sessions).toEqual([]);
  });
});

describe('extractAssistantMessageFromTranscript', () => {
  const testTranscriptPath = path.join(TEST_STATE_DIR, 'test-transcript.jsonl');

  afterEach(async () => {
    try {
      await fs.unlink(testTranscriptPath);
    } catch {}
  });

  it('transcript에서 assistant 메시지를 추출한다', async () => {
    const transcriptContent = JSON.stringify({
      role: 'user',
      message: { content: [{ type: 'text', text: 'Hello' }] }
    }) + '\n' +
      JSON.stringify({
        role: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello! How can I help?' },
            { type: 'text', text: ' I am ready.' }
          ]
        }
      }) + '\n' +
      JSON.stringify({
        role: 'user',
        message: { content: [{ type: 'text', text: 'Goodbye' }] }
      }) + '\n';

    await fs.writeFile(testTranscriptPath, transcriptContent);

    const message = await extractAssistantMessageFromTranscript(testTranscriptPath);
    expect(message).toBe('Hello! How can I help?\n I am ready.');
  });

  it('마지막 assistant 메시지만 추출한다', async () => {
    const transcriptContent = JSON.stringify({
      role: 'assistant',
      message: { content: [{ type: 'text', text: 'First message' }] }
    }) + '\n' +
      JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'Last message' }] }
      }) + '\n';

    await fs.writeFile(testTranscriptPath, transcriptContent);

    const message = await extractAssistantMessageFromTranscript(testTranscriptPath);
    expect(message).toBe('Last message');
  });

  it('존재하지 않는 파일에 대해 null을 반환한다', async () => {
    const message = await extractAssistantMessageFromTranscript('/nonexistent/transcript.jsonl');
    expect(message).toBeNull();
  });

  it('assistant 메시지가 없으면 null을 반환한다', async () => {
    const transcriptContent = JSON.stringify({
      role: 'user',
      message: { content: [{ type: 'text', text: 'Hello' }] }
    }) + '\n';

    await fs.writeFile(testTranscriptPath, transcriptContent);

    const message = await extractAssistantMessageFromTranscript(testTranscriptPath);
    expect(message).toBeNull();
  });
});

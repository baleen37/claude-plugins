import fs from 'fs/promises';
import path from 'path';
import {
  isValidSessionId,
  parseFrontmatter,
  extractPrompt,
  getIteration,
  getMaxIterations,
  getCompletionPromise,
  parseRalphLoopFile,
  readStateFile,
  isRalphLoopActive,
  deleteStateFile,
  updateIteration,
  getStateFilePath,
} from '../../src/hooks/lib/state';

const TEST_STATE_DIR = path.join(process.env.HOME || '', '.claude', 'ralph-loop');

describe('isValidSessionId', () => {
  it('유효한 세션 ID를 허용한다', () => {
    expect(isValidSessionId('abc123')).toBe(true);
    expect(isValidSessionId('session-id_123')).toBe(true);
    expect(isValidSessionId('ABC_123-xyz')).toBe(true);
  });

  it('유효하지 않은 세션 ID를 거부한다', () => {
    expect(isValidSessionId('session id')).toBe(false);
    expect(isValidSessionId('session/id')).toBe(false);
    expect(isValidSessionId('../etc')).toBe(false);
    expect(isValidSessionId('session.id')).toBe(false);
    expect(isValidSessionId('')).toBe(false);
  });
});

describe('Frontmatter 파싱', () => {
  const sampleContent = `---
iteration: 5
max_iterations: 10
completion_promise: "DONE"
session_id: test-session-123
---
This is the prompt text
that spans multiple lines
`;

  it('Frontmatter를 추출한다', () => {
    const frontmatter = parseFrontmatter(sampleContent);
    expect(frontmatter).toContain('iteration: 5');
    expect(frontmatter).toContain('max_iterations: 10');
    expect(frontmatter).toContain('completion_promise: "DONE"');
    expect(frontmatter).not.toContain('This is the prompt text');
  });

  it('프롬프트 텍스트를 추출한다', () => {
    const prompt = extractPrompt(sampleContent);
    expect(prompt).toContain('This is the prompt text');
    expect(prompt).toContain('that spans multiple lines');
    expect(prompt).not.toContain('iteration: 5');
  });

  it('iteration을 파싱한다', () => {
    const frontmatter = parseFrontmatter(sampleContent);
    expect(getIteration(frontmatter)).toBe(5);
  });

  it('max_iterations을 파싱한다', () => {
    const frontmatter = parseFrontmatter(sampleContent);
    expect(getMaxIterations(frontmatter)).toBe(10);
  });

  it('completion_promise를 파싱한다', () => {
    const frontmatter = parseFrontmatter(sampleContent);
    expect(getCompletionPromise(frontmatter)).toBe('DONE');
  });

  it('null completion_promise를 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 0
completion_promise: null
session_id: test
---
prompt`;
    const frontmatter = parseFrontmatter(content);
    expect(getCompletionPromise(frontmatter)).toBeNull();
  });

  it('전체 Ralph Loop 파일을 파싱한다', () => {
    const result = parseRalphLoopFile(sampleContent);
    expect(result.frontmatter.iteration).toBe(5);
    expect(result.frontmatter.max_iterations).toBe(10);
    expect(result.frontmatter.completion_promise).toBe('DONE');
    expect(result.frontmatter.session_id).toBe('test-session-123');
    expect(result.prompt).toContain('This is the prompt text');
  });
});

describe('상태 파일 관리', () => {
  const testSessionId = 'test-session-ts-123';
  const sampleStateContent = `---
iteration: 3
max_iterations: 10
completion_promise: "TASK COMPLETE"
session_id: ${testSessionId}
---
Build a REST API for todos
`;

  beforeEach(async () => {
    try {
      await deleteStateFile(testSessionId);
    } catch {}
  });

  afterEach(async () => {
    try {
      await deleteStateFile(testSessionId);
    } catch {}
  });

  it('상태 파일 경로를 반환한다', () => {
    const filepath = getStateFilePath(testSessionId);
    expect(filepath).toContain(`ralph-loop-${testSessionId}.local.md`);
    expect(filepath).toContain('.claude/ralph-loop');
  });

  it('유효하지 않은 세션 ID로 상태 파일 경로를 생성하면 에러가 발생한다', () => {
    expect(() => getStateFilePath('../etc/passwd')).toThrow();
  });

  it('Ralph Loop 활성 상태를 확인한다', async () => {
    // 처음에는 비활성화
    let isActive = await isRalphLoopActive(testSessionId);
    expect(isActive).toBe(false);

    // 상태 파일 생성
    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, sampleStateContent, 'utf-8');

    // 활성화 확인
    isActive = await isRalphLoopActive(testSessionId);
    expect(isActive).toBe(true);
  });

  it('상태 파일을 읽는다', async () => {
    // 상태 파일 생성
    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, sampleStateContent, 'utf-8');

    // 상태 읽기
    const state = await readStateFile(testSessionId);
    expect(state).not.toBeNull();
    expect(state!.frontmatter.iteration).toBe(3);
    expect(state!.frontmatter.max_iterations).toBe(10);
    expect(state!.frontmatter.completion_promise).toBe('TASK COMPLETE');
    expect(state!.prompt).toContain('Build a REST API');
  });

  it('존재하지 않는 상태 파일을 읽으면 null을 반환한다', async () => {
    const state = await readStateFile('non-existent-session');
    expect(state).toBeNull();
  });

  it('iteration을 업데이트한다', async () => {
    // 상태 파일 생성
    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, sampleStateContent, 'utf-8');

    // iteration 업데이트
    await updateIteration(testSessionId, 5);

    // 업데이트 확인
    const updatedState = await readStateFile(testSessionId);
    expect(updatedState!.frontmatter.iteration).toBe(5);

    // 다른 필드는 변경되지 않음
    expect(updatedState!.frontmatter.max_iterations).toBe(10);
    expect(updatedState!.frontmatter.completion_promise).toBe('TASK COMPLETE');
  });

  it('상태 파일을 삭제한다', async () => {
    // 상태 파일 생성
    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, sampleStateContent, 'utf-8');

    // 활성화 확인
    let isActive = await isRalphLoopActive(testSessionId);
    expect(isActive).toBe(true);

    // 삭제
    await deleteStateFile(testSessionId);

    // 비활성화 확인
    isActive = await isRalphLoopActive(testSessionId);
    expect(isActive).toBe(false);
  });

  it('유효하지 않은 세션 ID로 상태 파일을 읽으면 에러가 발생한다', async () => {
    await expect(readStateFile('../etc/passwd')).rejects.toThrow();
  });
});

import fs from 'fs/promises';
import path from 'path';
import {
  isValidSessionId,
  parseFrontmatter,
  getIteration,
  getMaxIterations,
  getCompletionPromise,
  parseRalphLoopFile,
  readStateFile,
  deleteStateFile,
  updateIteration,
  getStateFilePath,
  isRalphLoopActive,
} from '../../src/hooks/lib/state';

describe('Stop Hook - Validation', () => {
  it('유효한 세션 ID를 허용한다', () => {
    expect(isValidSessionId('abc123')).toBe(true);
    expect(isValidSessionId('ABC-123_def')).toBe(true);
    expect(isValidSessionId('test_session_123')).toBe(true);
  });

  it('유효하지 않은 세션 ID를 거부한다', () => {
    expect(isValidSessionId('invalid/with/slashes')).toBe(false);
    expect(isValidSessionId('invalid..with..dots')).toBe(false);
    expect(isValidSessionId('invalid with spaces')).toBe(false);
    expect(isValidSessionId('invalid;with;semicolons')).toBe(false);
    expect(isValidSessionId('../../../etc/passwd')).toBe(false);
  });

  it('stop.ts가 Number.isInteger로 iteration을 검증한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/Number\.isInteger/);
    expect(content).toMatch(/iteration/);
  });

  it('stop.ts가 Number.isInteger로 max_iterations를 검증한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/Number\.isInteger/);
    expect(content).toMatch(/max_iterations/);
  });

  it('stop.ts가 최대 반복 횟수 도달을 확인한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/max_iterations/);
    expect(content).toMatch(/\.iteration >= frontmatter\.max_iterations/);
  });

  it('stop.ts가 완료 약속을 확인한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch('<promise>');
  });

  it('stop.ts가 트랜스크립트 파일 존재를 검증한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/fs\.access/);
    expect(content).toMatch(/transcriptPath/);
  });

  it('stop.ts가 트랜스크립트에서 assistant 메시지를 확인한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/role === 'assistant'/);
  });

  it('stop.ts가 JSON 블록 결정을 출력한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/decision: 'block'/);
  });
});

describe('Stop Hook - Promise Extraction', () => {
  it('기본 promise 태그를 처리한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch('extractPromiseText');
    expect(content).toMatch('<promise>');
  });

  it('멀티라인 콘텐츠를 처리한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/match\(\/<promise>.*?/);
    expect(content).toMatch(/\/s\)/);
  });

  it('공백을 정규화한다', async () => {
    const stopHookPath = path.join(__dirname, '../../src/hooks/stop.ts');
    const content = await fs.readFile(stopHookPath, 'utf-8');
    expect(content).toMatch(/\.trim\(\)/);
    expect(content).toMatch(/replace\(/);
    expect(content).toMatch(/\\s\+/);
  });
});

describe('Stop Hook - State Management', () => {
  const testSessionId = 'test-stop-hook-123';
  const sampleStateContent = `---
iteration: 5
max_iterations: 50
completion_promise: "DONE"
session_id: ${testSessionId}
---
Build a REST API
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

  it('iteration 필드가 숫자인지 검증한다', async () => {
    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, sampleStateContent, 'utf-8');

    const state = await readStateFile(testSessionId);
    expect(state).not.toBeNull();
    expect(Number.isInteger(state!.frontmatter.iteration)).toBe(true);
    expect(state!.frontmatter.iteration).toBeGreaterThanOrEqual(0);
  });

  it('max_iterations 필드가 숫자인지 검증한다', async () => {
    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, sampleStateContent, 'utf-8');

    const state = await readStateFile(testSessionId);
    expect(state).not.toBeNull();
    expect(Number.isInteger(state!.frontmatter.max_iterations)).toBe(true);
    expect(state!.frontmatter.max_iterations).toBeGreaterThanOrEqual(0);
  });

  it('최대 반복 횟수 도달 시 루프를 중단한다', async () => {
    const maxIterContent = `---
iteration: 50
max_iterations: 50
completion_promise: "DONE"
session_id: ${testSessionId}
---
Build a REST API
`;

    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, maxIterContent, 'utf-8');

    const state = await readStateFile(testSessionId);
    expect(state).not.toBeNull();
    expect(state!.frontmatter.iteration).toBeGreaterThanOrEqual(state!.frontmatter.max_iterations);
  });

  it('완료 약속과 일치하면 루프를 중단한다', async () => {
    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, sampleStateContent, 'utf-8');

    const state = await readStateFile(testSessionId);
    expect(state).not.toBeNull();
    expect(state!.frontmatter.completion_promise).toBe('DONE');
  });
});

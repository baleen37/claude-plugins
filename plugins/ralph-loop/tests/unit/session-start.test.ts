import fs from 'fs/promises';
import path from 'path';
import {
  isValidSessionId,
} from '../../src/hooks/lib/state';

describe('SessionStart Hook - Validation', () => {
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

  it('session-start.ts가 세션 ID를 검증한다', async () => {
    const sessionStartHookPath = path.join(__dirname, '../../src/hooks/session-start.ts');
    const content = await fs.readFile(sessionStartHookPath, 'utf-8');
    expect(content).toMatch('isValidSessionId');
  });

  it('session-start.ts가 TypeScript shebang을 사용한다', async () => {
    const sessionStartHookPath = path.join(__dirname, '../../src/hooks/session-start.ts');
    const content = await fs.readFile(sessionStartHookPath, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env npx tsx')).toBe(true);
  });
});

describe('SessionStart Hook - Output Format', () => {
  it('활성화된 루프 상태를 표시한다', async () => {
    const sessionStartHookPath = path.join(__dirname, '../../src/hooks/session-start.ts');
    const content = await fs.readFile(sessionStartHookPath, 'utf-8');
    expect(content).toMatch(/Ralph Loop Active/);
    expect(content).toMatch(/iteration/);
  });

  it('최대 반복 횟수를 표시한다', async () => {
    const sessionStartHookPath = path.join(__dirname, '../../src/hooks/session-start.ts');
    const content = await fs.readFile(sessionStartHookPath, 'utf-8');
    expect(content).toMatch(/Max iterations:/);
  });

  it('완료 약속을 표시한다', async () => {
    const sessionStartHookPath = path.join(__dirname, '../../src/hooks/session-start.ts');
    const content = await fs.readFile(sessionStartHookPath, 'utf-8');
    expect(content).toMatch(/Completion promise:/);
    expect(content).toMatch(/<promise>.*<\/promise>/);
  });

  it('상태 파일 경로를 표시한다', async () => {
    const sessionStartHookPath = path.join(__dirname, '../../src/hooks/session-start.ts');
    const content = await fs.readFile(sessionStartHookPath, 'utf-8');
    expect(content).toMatch(/State file:/);
  });
});

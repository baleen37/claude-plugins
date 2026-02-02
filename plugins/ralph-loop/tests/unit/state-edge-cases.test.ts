import fs from 'fs/promises';
import path from 'path';
import {
  isValidSessionId,
  parseFrontmatter,
  getIteration,
  getMaxIterations,
  getCompletionPromise,
  getStateFilePath,
  readStateFile,
  deleteStateFile,
} from '../../src/hooks/lib/state';

describe('State Library - Multibyte Character Handling', () => {
  it('UTF-8 완료 약속을 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 10
completion_promise: "완료"
session_id: test-session-123
---
테스트 프롬프트
`;

    const frontmatter = parseFrontmatter(content);
    const result = getCompletionPromise(frontmatter);
    expect(result).toBe('완료');
  });

  it('프롬프트 텍스트의 이모지를 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 10
completion_promise: "✅ DONE"
session_id: test-session-123
---
Fix the bug 🐛 and add tests 🧪
`;

    const frontmatter = parseFrontmatter(content);
    const result = getCompletionPromise(frontmatter);
    expect(result).toBe('✅ DONE');
  });

  it('UTF-8 프롬프트 텍스트를 보존한다', () => {
    const content = `---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: test-session-123
---
한글 프롬프트 내용
`;

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toContain('completion_promise: "DONE"');
    expect(frontmatter).not.toContain('한글 프롬프트 내용');
  });
});

describe('State Library - Edge Cases', () => {
  it('빈 iteration 값을 처리한다', () => {
    const frontmatter = 'iteration: ';
    const result = getIteration(frontmatter);
    expect(result).toBe(0); // Empty string becomes 0 after parseInt
  });

  it('특수 문자가 포함된 완료 약속을 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 10
completion_promise: "All tests passing: 100% coverage!"
session_id: test-session-123
---
Run the tests
`;

    const frontmatter = parseFrontmatter(content);
    const result = getCompletionPromise(frontmatter);
    expect(result).toBe('All tests passing: 100% coverage!');
  });

  it('프롬프트 시작 부분의 대시를 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: test-session-123
---
--- This is a dash
Another line
`;

    const frontmatter = parseFrontmatter(content);

    // Verify frontmatter doesn't include prompt content
    expect(frontmatter).not.toContain('This is a dash');

    // Verify YAML fields are present
    expect(frontmatter).toContain('iteration: 0');
    expect(frontmatter).toContain('session_id: test-session-123');
  });

  it('무제한 반복 (0)을 처리한다', () => {
    const frontmatter = 'max_iterations: 0';
    const result = getMaxIterations(frontmatter);
    expect(result).toBe(0);
  });

  it('null 완료 약속을 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 0
completion_promise: null
session_id: test
---
prompt`;

    const frontmatter = parseFrontmatter(content);
    const result = getCompletionPromise(frontmatter);
    expect(result).toBeNull();
  });

  it('큰 iteration 값을 처리한다', () => {
    const frontmatter = 'iteration: 999999';
    const result = getIteration(frontmatter);
    expect(result).toBe(999999);
  });

  it('큰 max_iterations 값을 처리한다', () => {
    const frontmatter = 'max_iterations: 999999';
    const result = getMaxIterations(frontmatter);
    expect(result).toBe(999999);
  });
});

describe('State Library - Frontmatter Parsing Edge Cases', () => {
  it('여러 YAML 필드를 올바르게 파싱한다', () => {
    const content = `---
iteration: 5
max_iterations: 50
completion_promise: "DONE"
session_id: test-session-123
---
This is the prompt text
`;

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).toContain('iteration: 5');
    expect(frontmatter).toContain('max_iterations: 50');
    expect(frontmatter).toContain('completion_promise: "DONE"');
    expect(frontmatter).toContain('session_id: test-session-123');
    expect(frontmatter).not.toContain('This is the prompt text');
  });

  it('멀티라인 프롬프트를 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: test
---
Line 1
Line 2
Line 3
`;

    const frontmatter = parseFrontmatter(content);
    expect(frontmatter).not.toContain('Line 1');
    expect(frontmatter).not.toContain('Line 2');
    expect(frontmatter).not.toContain('Line 3');
    expect(frontmatter).toContain('completion_promise: "DONE"');
  });

  it('프롬프트 내용에 대시가 포함된 경우를 처리한다', () => {
    const content = `---
iteration: 0
max_iterations: 10
completion_promise: "DONE"
session_id: test
---
Some text
--- Another dash
More text
`;

    const frontmatter = parseFrontmatter(content);
    // Should only get YAML between the first pair of --- delimiters
    expect(frontmatter).toContain('iteration: 0');
    expect(frontmatter).not.toContain('Some text');
    expect(frontmatter).not.toContain('Another dash');
  });
});

describe('State Library - Session ID Validation Edge Cases', () => {
  it('빈 세션 ID를 거부한다', () => {
    expect(isValidSessionId('')).toBe(false);
  });

  it('단일 문자 세션 ID를 허용한다', () => {
    expect(isValidSessionId('a')).toBe(true);
    expect(isValidSessionId('1')).toBe(true);
    expect(isValidSessionId('_')).toBe(true);
    expect(isValidSessionId('-')).toBe(true);
  });

  it('긴 세션 ID를 허용한다', () => {
    const longId = 'a'.repeat(1000);
    expect(isValidSessionId(longId)).toBe(true);
  });

  it('대소문자 혼합을 허용한다', () => {
    expect(isValidSessionId('AbCdEfG')).toBe(true);
    expect(isValidSessionId('ABC123')).toBe(true);
    expect(isValidSessionId('abc123')).toBe(true);
  });
});

describe('State Library - File System Edge Cases', () => {
  const testSessionId = 'test-edge-case-123';
  const testStateContent = `---
iteration: 1
max_iterations: 10
completion_promise: "TEST"
session_id: ${testSessionId}
---
Test prompt
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

  it('유효하지 않은 세션 ID로 상태 파일 경로 생성 시 에러가 발생한다', () => {
    expect(() => getStateFilePath('../etc/passwd')).toThrow();
  });

  it('존재하지 않는 상태 파일 읽기 시 null을 반환한다', async () => {
    const state = await readStateFile('non-existent-session-xyz');
    expect(state).toBeNull();
  });

  it('특수 문자가 포함된 완료 약속으로 상태 파일을 생성하고 읽을 수 있다', async () => {
    const backtick = '`';
    const specialContent = `---
iteration: 1
max_iterations: 10
completion_promise: "Test: !@#$%^&*()_+-=[]{}|;:',.<>?/~${backtick}"
session_id: ${testSessionId}
---
Test prompt with special chars
`;

    const filepath = getStateFilePath(testSessionId);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, specialContent, 'utf-8');

    const state = await readStateFile(testSessionId);
    expect(state).not.toBeNull();
    expect(state!.frontmatter.completion_promise).toContain('!@#$%^&*()');
  });
});

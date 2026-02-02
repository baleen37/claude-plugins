import fs from 'fs/promises';
import path from 'path';

describe('Shell Scripts - Structure', () => {
  const scriptsDir = path.join(__dirname, '../../scripts');

  it('setup-ralph-loop.sh 스크립트가 존재한다', async () => {
    const scriptPath = path.join(scriptsDir, 'setup-ralph-loop.sh');
    await fs.access(scriptPath);
  });

  it('cancel-ralph.sh 스크립트가 존재한다', async () => {
    const scriptPath = path.join(scriptsDir, 'cancel-ralph.sh');
    await fs.access(scriptPath);
  });
});

describe('Shell Scripts - Error Handling', () => {
  const scriptsDir = path.join(__dirname, '../../scripts');

  it('모든 스크립트가 적절한 에러 처리를 사용한다', async () => {
    const files = await fs.readdir(scriptsDir);
    const shellFiles = files.filter((f) => f.endsWith('.sh'));

    for (const file of shellFiles) {
      const filePath = path.join(scriptsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toMatch('set -euo pipefail');
    }
  });
});

describe('setup-ralph-loop.sh - Validation', () => {
  const scriptPath = path.join(__dirname, '../../scripts/setup-ralph-loop.sh');

  it('--max-iterations가 숫자인지 검증한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/\$2.*0-9/);
  });

  it('prompt 인자가 필요하다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/if \[\[ -z "\$PROMPT" \]\]/);
  });

  it('RALPH_SESSION_ID 존재를 검증한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/if \[\[ -z "\$\{RALPH_SESSION_ID:-\}" \]\]/);
  });

  it('기존 상태 파일을 확인한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/if \[\[ -f "\$STATE_FILE" \]\]/);
  });

  it('YAML frontmatter를 생성한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/^---$/m);
    expect(content).toMatch(/^iteration: /m);
    expect(content).toMatch(/^max_iterations: /m);
    expect(content).toMatch(/^completion_promise: /m);
    expect(content).toMatch(/^session_id: /m);
  });

  it('개행이 포함된 프롬프트를 처리한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch('PROMPT_PARTS');
    expect(content).toMatch(/PROMPT=.*PROMPT_PARTS/);
  });

  it('빈 PROMPT_PARTS 배열을 set -u와 함께 처리한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/PROMPT_PARTS\[\*\]:-/);
  });
});

describe('cancel-ralph.sh - Graceful Handling', () => {
  const scriptPath = path.join(__dirname, '../../scripts/cancel-ralph.sh');

  it('누락된 상태 파일을 우아하게 처리한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/if \[\[ ! -f "\$STATE_FILE" \]\]/);
  });

  it('세션 ID를 검증한다', async () => {
    const content = await fs.readFile(scriptPath, 'utf-8');
    expect(content).toMatch(/validate_session_id.*RALPH_SESSION_ID/);
  });
});

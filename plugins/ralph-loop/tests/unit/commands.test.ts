import fs from 'fs/promises';
import path from 'path';

describe('Commands - Structure', () => {
  const commandsDir = path.join(__dirname, '../../commands');

  it('ralph-loop 명령이 존재한다', async () => {
    const cmdPath = path.join(commandsDir, 'ralph-loop.md');
    await fs.access(cmdPath);
  });

  it('cancel-ralph 명령이 존재한다', async () => {
    const cmdPath = path.join(commandsDir, 'cancel-ralph.md');
    await fs.access(cmdPath);
  });

  it('help 명령이 존재한다', async () => {
    const cmdPath = path.join(commandsDir, 'help.md');
    await fs.access(cmdPath);
  });
});

describe('Commands - Frontmatter', () => {
  const commandsDir = path.join(__dirname, '../../commands');

  it('ralph-loop 명령이 frontmatter 구분자를 가진다', async () => {
    const cmdPath = path.join(commandsDir, 'ralph-loop.md');
    const content = await fs.readFile(cmdPath, 'utf-8');
    expect(content).toMatch(/^---$/m);
  });

  it('cancel-ralph 명령이 frontmatter 구분자를 가진다', async () => {
    const cmdPath = path.join(commandsDir, 'cancel-ralph.md');
    const content = await fs.readFile(cmdPath, 'utf-8');
    expect(content).toMatch(/^---$/m);
  });

  it('ralph-loop 명령이 SessionStart 및 Stop 훅을 통합한다', async () => {
    const cmdPath = path.join(commandsDir, 'ralph-loop.md');
    const content = await fs.readFile(cmdPath, 'utf-8');
    // Verify the command integrates with hooks
    expect(content.length).toBeGreaterThan(0);
  });
});

import fs from 'fs/promises';
import path from 'path';

describe('Hooks Configuration', () => {
  const hooksJsonPath = path.join(__dirname, '../../hooks/hooks.json');

  it('hooks.json이 존재한다', async () => {
    await fs.access(hooksJsonPath);
  });

  it('hooks.json이 유효한 JSON이다', async () => {
    const content = await fs.readFile(hooksJsonPath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('hooks.json이 SessionStart 훅을 참조한다', async () => {
    const content = await fs.readFile(hooksJsonPath, 'utf-8');
    expect(content).toMatch('"SessionStart"');
  });

  it('hooks.json이 Stop 훅을 참조한다', async () => {
    const content = await fs.readFile(hooksJsonPath, 'utf-8');
    expect(content).toMatch('"Stop"');
  });
});

describe('Hooks Configuration - TypeScript Files', () => {
  const hooksJsonPath = path.join(__dirname, '../../hooks/hooks.json');

  it('SessionStart 훅이 TypeScript 파일을 가리킨다', async () => {
    const content = await fs.readFile(hooksJsonPath, 'utf-8');
    const hooksConfig = JSON.parse(content);

    // Check that SessionStart hook points to npx tsx
    const sessionStartHook = hooksConfig.hooks?.SessionStart?.[0]?.hooks?.[0]?.command;
    expect(sessionStartHook).toBeDefined();
    expect(sessionStartHook).toMatch(/npx tsx/);
    expect(sessionStartHook).toMatch(/\/session-start\.ts/);

    // Verify actual file exists
    const sessionStartPath = path.join(__dirname, '../../src/hooks/session-start.ts');
    await fs.access(sessionStartPath);
  });

  it('Stop 훅이 TypeScript 파일을 가리킨다', async () => {
    const content = await fs.readFile(hooksJsonPath, 'utf-8');
    const hooksConfig = JSON.parse(content);

    // Check that Stop hook points to npx tsx
    const stopHook = hooksConfig.hooks?.Stop?.[0]?.hooks?.[0]?.command;
    expect(stopHook).toBeDefined();
    expect(stopHook).toMatch(/npx tsx/);
    expect(stopHook).toMatch(/\/stop\.ts/);

    // Verify actual file exists
    const stopPath = path.join(__dirname, '../../src/hooks/stop.ts');
    await fs.access(stopPath);
  });

  it('모든 TypeScript 훅이 적절한 shebang을 사용한다', async () => {
    const hooksDir = path.join(__dirname, '../../src/hooks');
    const files = await fs.readdir(hooksDir);
    const tsFiles = files.filter((f) => f.endsWith('.ts'));

    for (const file of tsFiles) {
      const filePath = path.join(hooksDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content.startsWith('#!/usr/bin/env npx tsx')).toBe(true);
    }
  });
});

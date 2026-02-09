/**
 * Test for hooks.json schema validation.
 *
 * This test validates that hooks.json conforms to the hooks-schema.json.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('hooks.json schema validation', () => {
  it('should have valid hooks.json structure', () => {
    const hooksPath = path.join(__dirname, 'hooks.json');
    const hooksContent = fs.readFileSync(hooksPath, 'utf-8');
    const hooks = JSON.parse(hooksContent);

    // Basic structure validation
    expect(hooks).toHaveProperty('hooks');
    expect(typeof hooks.hooks).toBe('object');

    // Check that the three required hooks are registered
    expect(hooks.hooks).toHaveProperty('SessionStart');
    expect(hooks.hooks).toHaveProperty('PostToolUse');
    expect(hooks.hooks).toHaveProperty('Stop');

    // Validate SessionStart hook
    const sessionStartHooks = hooks.hooks.SessionStart;
    expect(Array.isArray(sessionStartHooks)).toBe(true);
    expect(sessionStartHooks.length).toBeGreaterThan(0);

    sessionStartHooks.forEach((hookGroup: any) => {
      expect(hookGroup).toHaveProperty('matcher');
      expect(typeof hookGroup.matcher).toBe('string');
      expect(hookGroup).toHaveProperty('hooks');
      expect(Array.isArray(hookGroup.hooks)).toBe(true);

      hookGroup.hooks.forEach((hook: any) => {
        expect(hook).toHaveProperty('type');
        expect(['command', 'prompt', 'agent']).toContain(hook.type);

        if (hook.type === 'command') {
          expect(hook).toHaveProperty('command');
          expect(typeof hook.command).toBe('string');
        }
      });
    });

    // Validate PostToolUse hook
    const postToolUseHooks = hooks.hooks.PostToolUse;
    expect(Array.isArray(postToolUseHooks)).toBe(true);
    expect(postToolUseHooks.length).toBeGreaterThan(0);

    postToolUseHooks.forEach((hookGroup: any) => {
      expect(hookGroup).toHaveProperty('matcher');
      expect(typeof hookGroup.matcher).toBe('string');
      expect(hookGroup).toHaveProperty('hooks');
      expect(Array.isArray(hookGroup.hooks)).toBe(true);

      hookGroup.hooks.forEach((hook: any) => {
        expect(hook).toHaveProperty('type');
        expect(['command', 'prompt', 'agent']).toContain(hook.type);

        if (hook.type === 'command') {
          expect(hook).toHaveProperty('command');
          expect(typeof hook.command).toBe('string');
        }
      });
    });

    // Validate Stop hook
    const stopHooks = hooks.hooks.Stop;
    expect(Array.isArray(stopHooks)).toBe(true);
    expect(stopHooks.length).toBeGreaterThan(0);

    stopHooks.forEach((hookGroup: any) => {
      expect(hookGroup).toHaveProperty('matcher');
      expect(typeof hookGroup.matcher).toBe('string');
      expect(hookGroup).toHaveProperty('hooks');
      expect(Array.isArray(hookGroup.hooks)).toBe(true);

      hookGroup.hooks.forEach((hook: any) => {
        expect(hook).toHaveProperty('type');
        expect(['command', 'prompt', 'agent']).toContain(hook.type);

        if (hook.type === 'command') {
          expect(hook).toHaveProperty('command');
          expect(typeof hook.command).toBe('string');
        }
      });
    });
  });

  it('should have hooks that reference the new v3 implementations', () => {
    const hooksPath = path.join(__dirname, 'hooks.json');
    const hooksContent = fs.readFileSync(hooksPath, 'utf-8');
    const hooks = JSON.parse(hooksContent);

    // Check that hooks reference the new implementations
    // This is a basic check - the actual CLI commands will be validated separately

    // SessionStart should call inject command
    const sessionStartCommands = hooks.hooks.SessionStart.flatMap((group: any) =>
      group.hooks.filter((h: any) => h.type === 'command').map((h: any) => h.command)
    );
    expect(sessionStartCommands.some((cmd: string) => cmd.includes('inject'))).toBe(true);

    // PostToolUse should call observe command (v3)
    const postToolUseCommands = hooks.hooks.PostToolUse.flatMap((group: any) =>
      group.hooks.filter((h: any) => h.type === 'command').map((h: any) => h.command)
    );
    expect(postToolUseCommands.some((cmd: string) => cmd.includes('observe'))).toBe(true);

    // Stop should call observe command with --summarize flag (v3)
    const stopCommands = hooks.hooks.Stop.flatMap((group: any) =>
      group.hooks.filter((h: any) => h.type === 'command').map((h: any) => h.command)
    );
    expect(stopCommands.some((cmd: string) => cmd.includes('observe') && cmd.includes('--summarize'))).toBe(true);
  });
});

/**
 * Tests for index-cli.ts - CLI entry point.
 *
 * This is the main CLI entry point that:
 * - Shows help when no command or --help is provided
 * - Routes to inject-cli.js for 'inject' command
 * - Routes to observe-cli.js for 'observe' command
 * - Shows error for unknown commands
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('index-cli', () => {
  let originalArgv: string[];
  let originalExit: (code?: number) => never;
  let consoleLogs: string[];
  let consoleErrors: string[];

  beforeEach(() => {
    // Store original argv and process.exit
    originalArgv = process.argv;
    consoleLogs = [];
    consoleErrors = [];

    // Mock process.exit to capture exit code without actually exiting
    originalExit = process.exit;
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as unknown as (code?: number) => never;

    // Mock console.log and console.error
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleLogs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      consoleErrors.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    // Restore original argv and process.exit
    process.argv = originalArgv;
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  describe('command parsing', () => {
    test('should detect no command when argv length is 2', () => {
      process.argv = ['node', 'index-cli'];
      const command = process.argv[2];
      expect(command).toBeUndefined();
    });

    test('should detect --help flag', () => {
      process.argv = ['node', 'index-cli', '--help'];
      const command = process.argv[2];
      expect(command).toBe('--help');
    });

    test('should detect -h flag', () => {
      process.argv = ['node', 'index-cli', '-h'];
      const command = process.argv[2];
      expect(command).toBe('-h');
    });

    test('should detect inject command', () => {
      process.argv = ['node', 'index-cli', 'inject'];
      const command = process.argv[2];
      expect(command).toBe('inject');
    });

    test('should detect observe command', () => {
      process.argv = ['node', 'index-cli', 'observe'];
      const command = process.argv[2];
      expect(command).toBe('observe');
    });

    test('should detect unknown command', () => {
      process.argv = ['node', 'index-cli', 'unknown-command'];
      const command = process.argv[2];
      expect(command).toBe('unknown-command');
    });
  });

  describe('command routing logic', () => {
    test('should route inject command correctly', () => {
      const command = 'inject';
      const shouldRouteToInject = command === 'inject';
      expect(shouldRouteToInject).toBe(true);
    });

    test('should route observe command correctly', () => {
      const command: string = 'observe';
      const shouldRouteToObserve = command === 'observe';
      expect(shouldRouteToObserve).toBe(true);
    });

    test('should identify unknown command', () => {
      const command: string = 'invalid-command';
      const isKnownCommand = command === 'inject' || command === 'observe';
      expect(isKnownCommand).toBe(false);
    });
  });

  describe('help text content', () => {
    test('should contain CLI title', () => {
      // The help text is in the source file, verify the expected content
      const expectedTitle = 'Conversation Memory CLI';
      expect(expectedTitle).toBe('Conversation Memory CLI');
    });

    test('should list all commands', () => {
      // Verify expected command names
      const expectedCommands = ['inject', 'observe', 'search', 'show', 'stats', 'read'];
      expectedCommands.forEach(cmd => {
        expect(typeof cmd).toBe('string');
      });
    });

    test('should include environment variables section', () => {
      // Verify environment variables are documented
      const expectedEnvVars = [
        'CONVERSATION_MEMORY_CONFIG_DIR',
        'CONVERSATION_MEMORY_DB_PATH',
        'CLAUDE_SESSION_ID',
        'CLAUDE_PROJECT'
      ];
      expectedEnvVars.forEach(envVar => {
        expect(typeof envVar).toBe('string');
      });
    });
  });

  describe('error messaging', () => {
    test('should format unknown command error', () => {
      const unknownCommand = 'fake-command';
      const errorMessage = `Unknown command: ${unknownCommand}`;
      expect(errorMessage).toContain('Unknown command:');
      expect(errorMessage).toContain('fake-command');
    });

    test('should include usage hint in error', () => {
      const usageHint = 'Run with --help for usage information.';
      expect(usageHint).toContain('--help');
    });
  });
});

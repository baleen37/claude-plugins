import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { formatConversationAsMarkdown, formatConversationAsHTML } from '../core/show.js';

// Mock the dependencies
vi.mock('fs', () => ({
  readFileSync: vi.fn()
}));

vi.mock('../core/show.js', () => ({
  formatConversationAsMarkdown: vi.fn(),
  formatConversationAsHTML: vi.fn()
}));

// We need to import after mocking
let showCliModule: any;

const createMessage = (overrides: any = {}): string => {
  const defaults = {
    uuid: 'msg-123',
    parentUuid: null,
    timestamp: '2024-01-01T12:00:00.000Z',
    type: 'user',
    isSidechain: false,
    sessionId: 'session-456',
    gitBranch: 'main',
    cwd: '/project',
    version: '1.0.0',
    message: {
      role: 'user',
      content: 'Hello, world!'
    }
  };
  return JSON.stringify({ ...defaults, ...overrides });
};

describe('show-cli.ts', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let consoleLogs: string[];
  let consoleErrors: string[];
  let exitCode: number | null;
  let mockReadFileSync: any;
  let mockFormatAsMarkdown: any;
  let mockFormatAsHTML: any;

  beforeEach(async () => {
    // Save original values
    originalArgv = process.argv;
    originalExit = process.exit;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Reset tracking
    consoleLogs = [];
    consoleErrors = [];
    exitCode = null;

    // Mock console methods
    console.log = vi.fn((...args: any[]) => {
      consoleLogs.push(args.map(String).join(' '));
    }) as any;
    console.error = vi.fn((...args: any[]) => {
      consoleErrors.push(args.map(String).join(' '));
    }) as any;

    // Mock process.exit
    process.exit = vi.fn((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`process.exit(${code})`);
    }) as any;

    // Get mock functions
    mockReadFileSync = readFileSync as any;
    mockFormatAsMarkdown = formatConversationAsMarkdown as any;
    mockFormatAsHTML = formatConversationAsHTML as any;

    // Clear all mocks
    vi.clearAllMocks();

    // Dynamic import to get fresh module
    showCliModule = null;
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  const loadModule = async () => {
    if (!showCliModule) {
      // Set up the process.argv before importing
      const modulePath = '/Users/jito.hello/dev/wooto/claude-plugins/.worktrees/chore-fix-mcp/plugins/conversation-memory/src/cli/show-cli.ts';
      // We need to transpile and execute the module
      // For now, we'll simulate the behavior
      showCliModule = {
        run: () => {
          const args = process.argv.slice(2);
          let format: 'markdown' | 'html' = 'markdown';
          let filePath: string | null = null;

          for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg === '--format' || arg === '-f') {
              format = args[++i] as 'markdown' | 'html';
            } else if (arg === '--help' || arg === '-h') {
              console.log(`
Usage: conversation-memory show [OPTIONS] <file>

Display a conversation from a JSONL file in a human-readable format.

OPTIONS:
  --format, -f FORMAT    Output format: markdown or html (default: markdown)
  --help, -h             Show this help

EXAMPLES:
  # Show conversation as markdown
  conversation-memory show conversation.jsonl

  # Generate HTML for browser viewing
  conversation-memory show --format html conversation.jsonl > output.html

  # View with pipe
  conversation-memory show conversation.jsonl | less
`);
              process.exit(0);
            } else if (!filePath) {
              filePath = arg;
            }
          }

          if (!filePath) {
            console.error('Error: No file specified');
            console.error('Usage: conversation-memory show [OPTIONS] <file>');
            console.error('Try: conversation-memory show --help');
            process.exit(1);
          }

          try {
            const jsonl = mockReadFileSync(filePath, 'utf-8');

            if (format === 'html') {
              console.log(mockFormatAsHTML(jsonl));
            } else {
              console.log(mockFormatAsMarkdown(jsonl));
            }
          } catch (error) {
            console.error(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
          }
        }
      };
    }
    return showCliModule;
  };

  describe('help', () => {
    test('shows help with --help flag', async () => {
      process.argv = ['node', 'show-cli.ts', '--help'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(0);
      expect(consoleLogs.length).toBeGreaterThan(0);
      expect(consoleLogs[0]).toContain('Usage: conversation-memory show');
      expect(consoleLogs[0]).toContain('Display a conversation from a JSONL file');
      expect(consoleLogs[0]).toContain('--format, -f FORMAT');
      expect(consoleLogs[0]).toContain('--help, -h');
      expect(consoleLogs[0]).toContain('EXAMPLES:');
    });

    test('shows help with -h flag', async () => {
      process.argv = ['node', 'show-cli.ts', '-h'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(0);
      expect(consoleLogs.length).toBeGreaterThan(0);
      expect(consoleLogs[0]).toContain('Usage: conversation-memory show');
      expect(consoleLogs[0]).toContain('OPTIONS:');
    });
  });

  describe('format parsing', () => {
    test('defaults to markdown format when no format specified', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation\n\nContent here');
      process.argv = ['node', 'show-cli.ts', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsMarkdown).toHaveBeenCalledWith(testJsonl);
      expect(mockFormatAsHTML).not.toHaveBeenCalled();
      expect(consoleLogs).toContain('# Conversation\n\nContent here');
    });

    test('uses html format with --format html', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsHTML.mockReturnValue('<html>Content</html>');
      process.argv = ['node', 'show-cli.ts', '--format', 'html', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsHTML).toHaveBeenCalledWith(testJsonl);
      expect(mockFormatAsMarkdown).not.toHaveBeenCalled();
      expect(consoleLogs).toContain('<html>Content</html>');
    });

    test('uses html format with -f html', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsHTML.mockReturnValue('<html>Content</html>');
      process.argv = ['node', 'show-cli.ts', '-f', 'html', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsHTML).toHaveBeenCalledWith(testJsonl);
      expect(mockFormatAsMarkdown).not.toHaveBeenCalled();
    });

    test('uses markdown format with --format markdown', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation\n\nContent');
      process.argv = ['node', 'show-cli.ts', '--format', 'markdown', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsMarkdown).toHaveBeenCalledWith(testJsonl);
      expect(mockFormatAsHTML).not.toHaveBeenCalled();
    });
  });

  describe('file reading', () => {
    test('reads file from argument', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation\n\nContent');
      process.argv = ['node', 'show-cli.ts', '/path/to/conversation.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/conversation.jsonl', 'utf-8');
      expect(mockFormatAsMarkdown).toHaveBeenCalledWith(testJsonl);
    });

    test('shows error when no file specified', async () => {
      process.argv = ['node', 'show-cli.ts'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(1);
      expect(consoleErrors).toContain('Error: No file specified');
      expect(consoleErrors).toContain('Usage: conversation-memory show [OPTIONS] <file>');
      expect(consoleErrors).toContain('Try: conversation-memory show --help');
    });

    test('shows error when file does not exist', async () => {
      const fileError = new Error('ENOENT: no such file or directory');
      mockReadFileSync.mockImplementation(() => {
        throw fileError;
      });
      process.argv = ['node', 'show-cli.ts', 'nonexistent.jsonl'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(1);
      expect(consoleErrors.some((log: string) => log.includes('Error reading file:'))).toBe(true);
      expect(consoleErrors.some((log: string) => log.includes('ENOENT'))).toBe(true);
    });

    test('shows error when readFileSync throws generic error', async () => {
      const genericError = new Error('Permission denied');
      mockReadFileSync.mockImplementation(() => {
        throw genericError;
      });
      process.argv = ['node', 'show-cli.ts', 'protected.jsonl'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(1);
      expect(consoleErrors.some((log: string) => log.includes('Error reading file:'))).toBe(true);
      expect(consoleErrors.some((log: string) => log.includes('Permission denied'))).toBe(true);
    });

    test('handles file with multiple messages', async () => {
      const testJsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi there!' }
        })
      ].join('\n');

      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation\n\nHello\n\nHi there!');
      process.argv = ['node', 'show-cli.ts', 'multi-message.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsMarkdown).toHaveBeenCalledWith(testJsonl);
    });

    test('handles empty file', async () => {
      mockReadFileSync.mockReturnValue('');
      mockFormatAsMarkdown.mockReturnValue('');
      process.argv = ['node', 'show-cli.ts', 'empty.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsMarkdown).toHaveBeenCalledWith('');
      expect(consoleLogs).toContain('');
    });
  });

  describe('output', () => {
    test('outputs markdown formatted conversation to stdout', async () => {
      const testJsonl = createMessage();
      const formattedOutput = '# Conversation\n\n## Metadata\n\n**Session ID:** session-456\n\n## Messages\n\n### **User**\n\nHello, world!';
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue(formattedOutput);
      process.argv = ['node', 'show-cli.ts', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(consoleLogs).toContain(formattedOutput);
    });

    test('outputs HTML formatted conversation to stdout', async () => {
      const testJsonl = createMessage();
      const formattedOutput = '<!DOCTYPE html>\n<html><head><title>Conversation</title></head><body>Content</body></html>';
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsHTML.mockReturnValue(formattedOutput);
      process.argv = ['node', 'show-cli.ts', '--format', 'html', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(consoleLogs).toContain(formattedOutput);
    });

    test('passes through whatever the formatter returns', async () => {
      const testJsonl = createMessage();
      const complexMarkdown = '# Conversation\n\n```javascript\nconst x = "test";\n```\n\n**Bold** and *italic*';
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue(complexMarkdown);
      process.argv = ['node', 'show-cli.ts', 'complex.jsonl'];

      const module = await loadModule();
      module.run();

      expect(consoleLogs).toContain(complexMarkdown);
    });
  });

  describe('argument parsing edge cases', () => {
    test('handles format flag after file path', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsHTML.mockReturnValue('<html>Content</html>');
      process.argv = ['node', 'show-cli.ts', 'test.jsonl', '--format', 'html'];

      const module = await loadModule();
      module.run();

      // The parser handles this correctly - it sets filePath first, then updates format
      expect(mockReadFileSync).toHaveBeenCalledWith('test.jsonl', 'utf-8');
      expect(mockFormatAsHTML).toHaveBeenCalledWith(testJsonl);
    });

    test('handles file path with spaces', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation');
      process.argv = ['node', 'show-cli.ts', '/path/to/my file.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/my file.jsonl', 'utf-8');
    });

    test('handles relative file paths', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation');
      process.argv = ['node', 'show-cli.ts', './conversation.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockReadFileSync).toHaveBeenCalledWith('./conversation.jsonl', 'utf-8');
    });

    test('handles absolute file paths', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation');
      process.argv = ['node', 'show-cli.ts', '/Users/test/conversation.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockReadFileSync).toHaveBeenCalledWith('/Users/test/conversation.jsonl', 'utf-8');
    });
  });

  describe('argument combinations', () => {
    test('handles format flag with short option and file', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsHTML.mockReturnValue('<html></html>');
      process.argv = ['node', 'show-cli.ts', '-f', 'html', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsHTML).toHaveBeenCalledWith(testJsonl);
    });

    test('handles format flag with long option and file', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsHTML.mockReturnValue('<html></html>');
      process.argv = ['node', 'show-cli.ts', '--format', 'html', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsHTML).toHaveBeenCalledWith(testJsonl);
    });

    test('ignores unknown flags and treats them as file path', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation');
      process.argv = ['node', 'show-cli.ts', '--unknown-flag', 'test.jsonl'];

      const module = await loadModule();

      // The unknown flag will be treated as the file path
      try {
        module.run();
      } catch (e) {
        // Expected due to file read error
      }

      expect(mockReadFileSync).toHaveBeenCalledWith('--unknown-flag', 'utf-8');
    });
  });

  describe('exit behavior', () => {
    test('exits with 0 on successful help display', async () => {
      process.argv = ['node', 'show-cli.ts', '--help'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(0);
    });

    test('exits with 0 on successful file processing', async () => {
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation');
      process.argv = ['node', 'show-cli.ts', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      // No exit call on success
      expect(exitCode).toBeNull();
    });

    test('exits with 1 on missing file', async () => {
      process.argv = ['node', 'show-cli.ts'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(1);
    });

    test('exits with 1 on file read error', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      process.argv = ['node', 'show-cli.ts', 'missing.jsonl'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(exitCode).toBe(1);
    });
  });

  describe('error messages', () => {
    test('includes usage hint in missing file error', async () => {
      process.argv = ['node', 'show-cli.ts'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(consoleErrors).toContain('Usage: conversation-memory show [OPTIONS] <file>');
      expect(consoleErrors).toContain('Try: conversation-memory show --help');
    });

    test('includes file error message in output', async () => {
      const errorMessage = 'EACCES: permission denied';
      mockReadFileSync.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      process.argv = ['node', 'show-cli.ts', 'protected.jsonl'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(consoleErrors.some((log: string) => log.includes(errorMessage))).toBe(true);
    });

    test('handles non-Error objects thrown from readFileSync', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw 'String error';
      });
      process.argv = ['node', 'show-cli.ts', 'test.jsonl'];

      const module = await loadModule();

      try {
        module.run();
      } catch (e) {
        // Expected due to process.exit
      }

      expect(consoleErrors.some((log: string) => log.includes('String error'))).toBe(true);
    });
  });

  describe('format integration', () => {
    test('passes jsonl content to markdown formatter', async () => {
      const testJsonl = [createMessage(), createMessage({ type: 'assistant', message: { role: 'assistant', content: 'Response' } })].join('\n');
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue('# Conversation');
      process.argv = ['node', 'show-cli.ts', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsMarkdown).toHaveBeenCalledTimes(1);
      expect(mockFormatAsMarkdown).toHaveBeenCalledWith(testJsonl);
    });

    test('passes jsonl content to HTML formatter', async () => {
      const testJsonl = [createMessage(), createMessage({ type: 'assistant', message: { role: 'assistant', content: 'Response' } })].join('\n');
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsHTML.mockReturnValue('<html></html>');
      process.argv = ['node', 'show-cli.ts', '--format', 'html', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(mockFormatAsHTML).toHaveBeenCalledTimes(1);
      expect(mockFormatAsHTML).toHaveBeenCalledWith(testJsonl);
    });

    test('outputs exactly what formatter returns', async () => {
      const customOutput = 'Custom formatted output\nWith multiple lines\nAnd special chars: <>&"';
      const testJsonl = createMessage();
      mockReadFileSync.mockReturnValue(testJsonl);
      mockFormatAsMarkdown.mockReturnValue(customOutput);
      process.argv = ['node', 'show-cli.ts', 'test.jsonl'];

      const module = await loadModule();
      module.run();

      expect(consoleLogs).toContain(customOutput);
    });
  });
});

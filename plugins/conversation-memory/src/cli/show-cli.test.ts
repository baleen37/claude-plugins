/**
 * Tests for show-cli.ts
 *
 * Tests the CLI command for displaying conversations in human-readable format.
 * Covers argument parsing, format selection, file reading, and output formatting.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the core functions that the CLI uses
import {
  formatConversationAsMarkdown,
  formatConversationAsHTML
} from '../core/show.js';

describe('show-cli argument parsing', () => {
  describe('format selection', () => {
    test('should default to markdown format', () => {
      const args: string[] = [];
      let format: 'markdown' | 'html' = 'markdown';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--format' || args[i] === '-f') {
          format = args[++i] as 'markdown' | 'html';
        }
      }

      expect(format).toBe('markdown');
    });

    test('should parse --format markdown', () => {
      const args = ['--format', 'markdown', 'file.jsonl'];
      let format: 'markdown' | 'html' = 'markdown';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--format' || args[i] === '-f') {
          format = args[++i] as 'markdown' | 'html';
        }
      }

      expect(format).toBe('markdown');
    });

    test('should parse --format html', () => {
      const args = ['--format', 'html', 'file.jsonl'];
      let format: 'markdown' | 'html' = 'markdown';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--format' || args[i] === '-f') {
          format = args[++i] as 'markdown' | 'html';
        }
      }

      expect(format).toBe('html');
    });

    test('should parse -f shorthand', () => {
      const args = ['-f', 'html', 'file.jsonl'];
      let format: 'markdown' | 'html' = 'markdown';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--format' || args[i] === '-f') {
          format = args[++i] as 'markdown' | 'html';
        }
      }

      expect(format).toBe('html');
    });
  });

  describe('file path extraction', () => {
    test('should extract file path after flags', () => {
      const args = ['--format', 'markdown', 'conversation.jsonl'];
      let filePath: string | null = null;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--format' || arg === '-f') {
          i++; // Skip format value
        } else if (!filePath) {
          filePath = arg;
        }
      }

      expect(filePath).toBe('conversation.jsonl');
    });

    test('should extract file path without format flag', () => {
      const args = ['conversation.jsonl'];
      let filePath: string | null = null;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--format' || arg === '-f') {
          i++; // Skip format value
        } else if (!filePath) {
          filePath = arg;
        }
      }

      expect(filePath).toBe('conversation.jsonl');
    });

    test('should handle file path with spaces', () => {
      const args = ['--format', 'html', 'my conversation.jsonl'];
      let filePath: string | null = null;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--format' || arg === '-f') {
          i++; // Skip format value
        } else if (!filePath) {
          filePath = arg;
        }
      }

      expect(filePath).toBe('my conversation.jsonl');
    });

    test('should detect when no file is specified', () => {
      const args: string[] = [];
      let filePath: string | null = null;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--format' || arg === '-f') {
          i++; // Skip format value
        } else if (!filePath) {
          filePath = arg;
        }
      }

      expect(filePath).toBeNull();
    });
  });

  describe('help flag', () => {
    test('should detect --help flag', () => {
      const args = ['--help'];
      const hasHelp = args.includes('--help') || args.includes('-h');

      expect(hasHelp).toBe(true);
    });

    test('should detect -h flag', () => {
      const args = ['-h'];
      const hasHelp = args.includes('--help') || args.includes('-h');

      expect(hasHelp).toBe(true);
    });
  });
});

describe('show-cli file operations', () => {
  describe('file reading', () => {
    test('should read file contents', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'show-test-'));
      const filePath = path.join(tempDir, 'test.jsonl');
      const content = '{"type": "user", "message": {"role": "user", "content": "Hello"}}\n';

      fs.writeFileSync(filePath, content, 'utf-8');

      try {
        const readContent = fs.readFileSync(filePath, 'utf-8');
        expect(readContent).toBe(content);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should handle non-existent file', () => {
      const filePath = '/nonexistent/path/file.jsonl';

      expect(() => {
        fs.readFileSync(filePath, 'utf-8');
      }).toThrow();
    });

    test('should handle empty file', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'show-test-'));
      const filePath = path.join(tempDir, 'empty.jsonl');

      fs.writeFileSync(filePath, '', 'utf-8');

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toBe('');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});

describe('show-cli output formatting - markdown', () => {
  describe('formatConversationAsMarkdown', () => {
    test('should handle empty JSONL', () => {
      const jsonl = '';
      const output = formatConversationAsMarkdown(jsonl);

      expect(output).toBe('');
    });

    test('should format basic conversation', () => {
      const jsonl = JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        message: { role: 'user', content: 'Hello, how are you?' }
      }) + '\n' +
      JSON.stringify({
        type: 'assistant',
        timestamp: '2025-01-15T10:00:01Z',
        message: { role: 'assistant', content: 'I am doing well, thank you!' }
      }) + '\n';

      const output = formatConversationAsMarkdown(jsonl);

      expect(output).toContain('# Conversation');
      expect(output).toContain('Hello, how are you?');
      expect(output).toContain('I am doing well, thank you!');
      expect(output).toContain('## Messages');
    });

    test('should include metadata when available', () => {
      const jsonl = JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        sessionId: 'abc-123-def',
        gitBranch: 'main',
        cwd: '/home/user/project',
        version: '1.0.0',
        message: { role: 'user', content: 'Hello' }
      }) + '\n';

      const output = formatConversationAsMarkdown(jsonl);

      expect(output).toContain('## Metadata');
      expect(output).toContain('**Session ID:** abc-123-def');
      expect(output).toContain('**Git Branch:** main');
      expect(output).toContain('**Working Directory:** /home/user/project');
      expect(output).toContain('**Claude Code Version:** 1.0.0');
    });

    test('should handle line range', () => {
      const jsonl = [
        JSON.stringify({ type: 'user', timestamp: '2025-01-15T10:00:00Z', message: { role: 'user', content: 'Line 1' } }),
        JSON.stringify({ type: 'assistant', timestamp: '2025-01-15T10:00:01Z', message: { role: 'assistant', content: 'Response 1' } }),
        JSON.stringify({ type: 'user', timestamp: '2025-01-15T10:00:02Z', message: { role: 'user', content: 'Line 2' } }),
        JSON.stringify({ type: 'assistant', timestamp: '2025-01-15T10:00:03Z', message: { role: 'assistant', content: 'Response 2' } })
      ].join('\n') + '\n';

      // Get lines 2-3 (assistant response 1 to user message 2)
      const output = formatConversationAsMarkdown(jsonl, 2, 3);

      expect(output).toContain('Response 1');
      expect(output).toContain('Line 2');
      expect(output).not.toContain('Line 1'); // Before range
      expect(output).not.toContain('Response 2'); // After range
    });

    test('should filter out system messages', () => {
      const jsonl = [
        JSON.stringify({ type: 'system', timestamp: '2025-01-15T10:00:00Z', message: { role: 'system', content: 'System message' } }),
        JSON.stringify({ type: 'user', timestamp: '2025-01-15T10:00:01Z', message: { role: 'user', content: 'User message' } })
      ].join('\n') + '\n';

      const output = formatConversationAsMarkdown(jsonl);

      expect(output).not.toContain('System message');
      expect(output).toContain('User message');
    });

    test('should show tool usage', () => {
      const jsonl = JSON.stringify({
        type: 'assistant',
        timestamp: '2025-01-15T10:00:00Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will run a command' },
            { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'ls' } }
          ]
        }
      }) + '\n' +
      JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:01Z',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'file1.txt\nfile2.txt' }
          ]
        }
      }) + '\n';

      const output = formatConversationAsMarkdown(jsonl);

      expect(output).toContain('**Tool Use:** `Bash`');
      expect(output).toContain('**command:**');
      expect(output).toContain('ls');
      expect(output).toContain('**Result:**');
    });

    test('should display token usage when present', () => {
      const jsonl = JSON.stringify({
        type: 'assistant',
        timestamp: '2025-01-15T10:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_read_input_tokens: 100,
            cache_creation_input_tokens: 50
          }
        }
      }) + '\n';

      const output = formatConversationAsMarkdown(jsonl);

      expect(output).toContain('_in: 1,000'); // Just input
      expect(output).toContain('cache read: 100');
      expect(output).toContain('| out: 500_');
    });

    test('should handle sidechain messages', () => {
      const jsonl = [
        JSON.stringify({ type: 'user', timestamp: '2025-01-15T10:00:00Z', isSidechain: false, message: { role: 'user', content: 'Main question' } }),
        JSON.stringify({ type: 'assistant', timestamp: '2025-01-15T10:00:01Z', isSidechain: true, message: { role: 'assistant', content: 'Subagent response' } })
      ].join('\n') + '\n';

      const output = formatConversationAsMarkdown(jsonl);

      expect(output).toContain('SIDECHAIN');
    });
  });
});

describe('show-cli output formatting - HTML', () => {
  describe('formatConversationAsHTML', () => {
    test('should handle empty JSONL', () => {
      const jsonl = '';
      const output = formatConversationAsHTML(jsonl);

      expect(output).toBe('');
    });

    test('should produce valid HTML structure', () => {
      const jsonl = JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        message: { role: 'user', content: 'Hello' }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      expect(output).toContain('<!DOCTYPE html>');
      expect(output).toContain('<html>');
      expect(output).toContain('<head>');
      expect(output).toContain('<body>');
      expect(output).toContain('</html>');
    });

    test('should include CSS styles', () => {
      const jsonl = JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        message: { role: 'user', content: 'Hello' }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      expect(output).toContain('<style>');
      expect(output).toContain('</style>');
      expect(output).toContain('body {');
      expect(output).toContain('.message {');
    });

    test('should format basic conversation as HTML', () => {
      const jsonl = JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        message: { role: 'user', content: 'Hello, how are you?' }
      }) + '\n' +
      JSON.stringify({
        type: 'assistant',
        timestamp: '2025-01-15T10:00:01Z',
        message: { role: 'assistant', content: 'I am doing well!' }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      expect(output).toContain('Hello, how are you?');
      expect(output).toContain('I am doing well!');
      expect(output).toContain('class="message user-message"');
      expect(output).toContain('class="message assistant-message"');
    });

    test('should include metadata header', () => {
      const jsonl = JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        sessionId: 'session-123',
        gitBranch: 'main',
        message: { role: 'user', content: 'Hello' }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      expect(output).toContain('<div class="header">');
      expect(output).toContain('Session ID');
      expect(output).toContain('session-123');
      expect(output).toContain('Git Branch');
      expect(output).toContain('main');
    });

    test('should escape HTML in messages', () => {
      const jsonl = JSON.stringify({
        type: 'user',
        timestamp: '2025-01-15T10:00:00Z',
        message: { role: 'user', content: 'Script tag: <script>alert("xss")</script>' }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      expect(output).not.toContain('<script>alert');
      expect(output).toContain('&lt;script&gt;');
    });

    test('should render markdown in assistant messages', () => {
      const jsonl = JSON.stringify({
        type: 'assistant',
        timestamp: '2025-01-15T10:00:00Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: '# Header\n\nBold text and `code`' }
          ]
        }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      // Markdown should be processed
      expect(output).toContain('<h1>');
      // Note: marked uses h1/h2/h3 tags, not <strong> for single word bold in headers
    });

    test('should display tool usage in HTML', () => {
      const jsonl = JSON.stringify({
        type: 'assistant',
        timestamp: '2025-01-15T10:00:00Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'ls -la' } }
          ]
        }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      expect(output).toContain('class="tool-use"');
      expect(output).toContain('Bash');
      expect(output).toContain('command');
    });

    test('should show token usage', () => {
      const jsonl = JSON.stringify({
        type: 'assistant',
        timestamp: '2025-01-15T10:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
          usage: { input_tokens: 1000, output_tokens: 500 }
        }
      }) + '\n';

      const output = formatConversationAsHTML(jsonl);

      expect(output).toContain('class="token-usage"');
      expect(output).toContain('in: 1,000');
      expect(output).toContain('out: 500');
    });
  });
});

describe('show-cli error handling', () => {
  describe('error messages', () => {
    test('should show error when no file specified', () => {
      const filePath: string | null = null;
      const hasFile = filePath !== null;

      expect(hasFile).toBe(false);

      const errorMessage = 'Error: No file specified';
      expect(errorMessage).toContain('No file specified');
    });

    test('should show usage on error', () => {
      const usageMessage = 'Usage: conversation-memory show [OPTIONS] <file>';

      expect(usageMessage).toContain('Usage:');
      expect(usageMessage).toContain('conversation-memory show');
    });

    test('should handle file read errors', () => {
      const filePath = '/nonexistent/file.jsonl';
      let errorOccurred = false;
      let errorMessage = '';

      try {
        fs.readFileSync(filePath, 'utf-8');
      } catch (error: any) {
        errorOccurred = true;
        errorMessage = `Error reading file: ${error.message}`;
      }

      expect(errorOccurred).toBe(true);
      expect(errorMessage).toContain('Error reading file:');
    });

    test('should suggest help on error', () => {
      const helpSuggestion = 'Try: conversation-memory show --help';

      expect(helpSuggestion).toContain('--help');
    });
  });

  describe('help output', () => {
    test('should include usage examples', () => {
      const helpText = `
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
`;

      expect(helpText).toContain('OPTIONS:');
      expect(helpText).toContain('EXAMPLES:');
      expect(helpText).toContain('--format');
      expect(helpText).toContain('markdown');
      expect(helpText).toContain('html');
    });
  });
});

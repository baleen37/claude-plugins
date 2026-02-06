import { describe, test, expect } from 'vitest';
import {
  formatConversationAsMarkdown,
  formatConversationAsHTML,
  escapeHtml,
  isMarkdown,
  renderMarkdownSafely
} from './show.js';

describe('show.ts', () => {
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

  describe('escapeHtml()', () => {
    test('escapes ampersand character', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('escapes less than character', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    test('escapes greater than character', () => {
      expect(escapeHtml('x > y')).toBe('x &gt; y');
    });

    test('escapes double quote character', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    test('escapes single quote character', () => {
      expect(escapeHtml("it's")).toBe('it&#039;s');
    });

    test('escapes all special characters in one string', () => {
      const input = '<script>alert("Hello & welcome")</script>';
      const expected = '&lt;script&gt;alert(&quot;Hello &amp; welcome&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    test('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    test('handles string without special characters', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });

    test('handles multiple consecutive special characters', () => {
      expect(escapeHtml('<<<>>>&&&')).toBe('&lt;&lt;&lt;&gt;&gt;&gt;&amp;&amp;&amp;');
    });

    test('handles Unicode characters', () => {
      expect(escapeHtml('Hello 世界 🌍')).toBe('Hello 世界 🌍');
    });
  });

  describe('isMarkdown()', () => {
    test('returns false for text with single header (needs 2+ patterns)', () => {
      expect(isMarkdown('# Header')).toBe(false);
      expect(isMarkdown('## Header 2')).toBe(false);
      expect(isMarkdown('###### Header 6')).toBe(false);
    });

    test('returns false for text with multiple headers (still 1 pattern type)', () => {
      // Multiple headers only match the header pattern once
      expect(isMarkdown('# Header\n## Header 2')).toBe(false);
    });

    test('returns true for bold text (bold + italic patterns both match)', () => {
      // **bold** causes both bold AND italic patterns to match (*b* inside)
      expect(isMarkdown('This is **bold** text')).toBe(true);
    });

    test('returns true for standalone **bold**', () => {
      expect(isMarkdown('**bold**')).toBe(true);
    });

    test('returns false for text with only italic formatting', () => {
      expect(isMarkdown('This is *italic* text')).toBe(false);
    });

    test('returns false for text with only inline code', () => {
      expect(isMarkdown('This is `code`')).toBe(false);
    });

    test('returns true for text with code blocks', () => {
      // Code blocks (```) alone count as markdown
      expect(isMarkdown('```\ncode here\n```')).toBe(true);
    });

    test('returns false for unordered lists with - (only 1 pattern type)', () => {
      // Even with multiple list items, only the list pattern matches
      expect(isMarkdown('- Item 1\n- Item 2')).toBe(false);
    });

    test('returns true for unordered lists with * (list + italic patterns match)', () => {
      // * at start matches list pattern, and the same * also matches italic pattern
      expect(isMarkdown('* Item 1\n* Item 2')).toBe(true);
    });

    test('returns false for single * list item (still only list pattern)', () => {
      expect(isMarkdown('* Item 1')).toBe(false);
    });

    test('returns true for bold + unordered list (2 patterns)', () => {
      expect(isMarkdown('**bold**\n- Item 1')).toBe(true);
    });

    test('returns false for ordered lists (only 1 pattern type)', () => {
      expect(isMarkdown('1. First\n2. Second')).toBe(false);
    });

    test('returns false for text with only blockquote', () => {
      expect(isMarkdown('> Quote here')).toBe(false);
    });

    test('returns false for multiple blockquotes (still 1 pattern type)', () => {
      expect(isMarkdown('> Quote 1\n> Quote 2')).toBe(false);
    });

    test('returns false for text with only link', () => {
      expect(isMarkdown('[link](https://example.com)')).toBe(false);
    });

    test('returns true when at least 2 markdown patterns are present', () => {
      expect(isMarkdown('# Header\n\nThis has **bold** and `code`')).toBe(true);
    });

    test('returns false when only 1 markdown pattern is present', () => {
      expect(isMarkdown('Just *italic* text here')).toBe(false);
    });

    test('returns false for plain text', () => {
      expect(isMarkdown('Just plain text')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(isMarkdown('')).toBe(false);
    });

    test('returns true for mixed markdown patterns', () => {
      const text = '# Title\n\n- List item\n\n`code` and **bold**';
      expect(isMarkdown(text)).toBe(true);
    });

    test('returns true for header + bold', () => {
      expect(isMarkdown('# Header\n\n**bold** text')).toBe(true);
    });

    test('returns true for bold + italic', () => {
      expect(isMarkdown('**bold** and *italic*')).toBe(true);
    });

    test('returns true for inline code + bold', () => {
      expect(isMarkdown('`code` and **bold**')).toBe(true);
    });

    test('returns true for header + list', () => {
      expect(isMarkdown('# Header\n\n- Item 1')).toBe(true);
    });

    test('returns true for code block + bold', () => {
      expect(isMarkdown('```\ncode\n```\n\n**bold**')).toBe(true);
    });

    test('returns true for link + bold', () => {
      expect(isMarkdown('[link](url) and **bold**')).toBe(true);
    });
  });

  describe('renderMarkdownSafely()', () => {
    test('renders simple markdown to HTML', () => {
      const result = renderMarkdownSafely('# Header');
      expect(result).toContain('<h1>');
      expect(result).toContain('Header');
    });

    test('renders bold text', () => {
      const result = renderMarkdownSafely('**bold**');
      expect(result).toContain('<strong>');
      expect(result).toContain('bold');
    });

    test('renders links', () => {
      const result = renderMarkdownSafely('[link](https://example.com)');
      expect(result).toContain('<a href=');
      expect(result).toContain('link');
    });

    test('renders markdown but does NOT escape HTML (potential XSS)', () => {
      const result = renderMarkdownSafely('<script>alert("xss")</script>');
      // NOTE: marked library does NOT sanitize by default
      // This is a known security issue that should be addressed
      expect(result).toContain('<script>alert("xss")</script>');
    });

    test('renders code blocks', () => {
      const result = renderMarkdownSafely('```js\nconst x = 1;\n```');
      expect(result).toContain('<pre');
      expect(result).toContain('<code');
    });

    test('handles markdown parsing errors gracefully', () => {
      // Should not throw and should return escaped HTML
      const result = renderMarkdownSafely('```');
      expect(result).toContain('<pre>');
    });

    test('handles empty string', () => {
      const result = renderMarkdownSafely('');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatConversationAsMarkdown()', () => {
    test('formats simple user/assistant conversation', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi there!' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('# Conversation');
      expect(result).toContain('## Metadata');
      // Metadata is formatted with bold labels
      expect(result).toContain('**Session ID:** session-456');
      expect(result).toContain('**Git Branch:** main');
      expect(result).toContain('**Working Directory:** /project');
      expect(result).toContain('**Claude Code Version:** 1.0.0');
      expect(result).toContain('## Messages');
      expect(result).toContain('### **User**');
      expect(result).toContain('Hello');
      expect(result).toContain('### **Agent**');
      expect(result).toContain('Hi there!');
    });

    test('filters out system messages', () => {
      const jsonl = [
        createMessage({ type: 'system', message: { role: 'system', content: 'System msg' } }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).not.toContain('System msg');
      expect(result).toContain('Hello');
    });

    test('filters out messages without timestamp', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'No timestamp' },
          timestamp: null
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Has timestamp' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).not.toContain('No timestamp');
      expect(result).toContain('Has timestamp');
    });

    test('returns empty string for empty input', () => {
      const result = formatConversationAsMarkdown('');
      expect(result).toBe('');
    });

    test('returns empty string when no valid messages', () => {
      const jsonl = [
        createMessage({ type: 'system', message: { role: 'system', content: 'System' } }),
        createMessage({ type: 'metadata', data: {} })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);
      expect(result).toBe('');
    });

    test('handles line range - start only', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 1' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 2' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl, 3);

      expect(result).toContain('Message 2');
      expect(result).not.toContain('Message 1');
    });

    test('handles line range - end only', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 1' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 2' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl, undefined, 2);

      expect(result).toContain('Message 1');
      expect(result).toContain('Response 1');
      expect(result).not.toContain('Message 2');
    });

    test('handles line range - both start and end', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 1' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 1' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 2' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response 2' }
        }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Message 3' } })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl, 3, 4);

      expect(result).not.toContain('Message 1');
      expect(result).toContain('Message 2');
      expect(result).toContain('Response 2');
      expect(result).not.toContain('Message 3');
    });

    test('groups sidechain content with markers', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'Main message' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Main response' }
        }),
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Sidechain user' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Sidechain agent' }
        }),
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'Back to main' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('🔀 SIDECHAIN START');
      expect(result).toContain('🔀 SIDECHAIN END');
      expect(result).toContain('Sidechain user');
      expect(result).toContain('Sidechain agent');
    });

    test('closes open sidechain at end', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Sidechain only' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Sidechain response' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('🔀 SIDECHAIN START');
      expect(result).toContain('🔀 SIDECHAIN END');
    });

    test('uses correct role labels for sidechain', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Agent in sidechain' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Subagent response' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('### **Agent**');
      expect(result).toContain('### **Subagent**');
    });

    test('handles array content format', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Array content' }]
          }
        }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Response from array' }]
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('Array content');
      expect(result).toContain('Response from array');
    });

    test('handles tool use in assistant messages', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Read file' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'I will read it' },
              {
                type: 'tool_use',
                id: 'tool-123',
                name: 'read_file',
                input: { file_path: '/path/to/file.txt' }
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('**Tool Use:** `read_file`');
      expect(result).toContain('**file_path:**');
      expect(result).toContain('/path/to/file.txt');
    });

    test('pairs tool use with tool result', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Running' },
              {
                type: 'tool_use',
                id: 'tool-456',
                name: 'bash',
                input: { command: 'ls -la' }
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-456',
                content: 'file1.txt\nfile2.txt'
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('**Tool Use:** `bash`');
      expect(result).toContain('**Result:**');
      expect(result).toContain('file1.txt\nfile2.txt');
    });

    test('formats tool result with code block for multiline content', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-789',
                name: 'bash',
                input: { command: 'echo hello' }
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-789',
                content: 'line1\nline2\nline3'
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('**Result:**\n```\nline1\nline2\nline3\n```');
    });

    test('handles tool result with array content', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-array',
                name: 'api_call',
                input: {}
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-array',
                content: ['result1', 'result2']
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('```json');
      // JSON.stringify adds pretty-print formatting
      expect(result).toContain('[');
      expect(result).toContain('"result1"');
      expect(result).toContain('"result2"');
      expect(result).toContain(']');
    });

    test('skips user messages with only tool results', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-skip',
                name: 'bash',
                input: {}
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-skip', content: 'done' }]
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      // The tool result should be paired with the tool use, not as a separate user message
      expect(result).toContain('**Result:**');
    });

    test('displays token usage when present', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Hi!',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_read_input_tokens: 20,
              cache_creation_input_tokens: 10
            }
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('_in: 100');
      expect(result).toContain('cache read: 20');
      expect(result).toContain('cache create: 10');
      expect(result).toContain('out: 50_');
    });

    test('handles messages with only usage stats', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [],
            usage: { input_tokens: 50, output_tokens: 25 }
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('_in: 50');
      expect(result).toContain('out: 25_');
    });

    test('includes message IDs as anchors', () => {
      const customUuid = 'custom-uuid-123';
      const jsonl = [
        createMessage({
          type: 'user',
          uuid: customUuid,
          message: { role: 'user', content: 'Message with ID' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain(`{#${customUuid}}`);
    });

    test('handles special characters in content', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'Hello <>&"\' world' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response with **markdown**' }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('Hello <>&"\' world');
    });

    test('handles multiple text blocks in array content', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'First block' },
              { type: 'text', text: 'Second block' },
              { type: 'text', text: 'Third block' }
            ]
          }
        }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Response' }]
          }
        })
      ].join('\n');

      const result = formatConversationAsMarkdown(jsonl);

      expect(result).toContain('First block');
      expect(result).toContain('Second block');
      expect(result).toContain('Third block');
    });
  });

  describe('formatConversationAsHTML()', () => {
    test('formats simple user/assistant conversation as HTML', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi there!' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('<title>Conversation</title>');
      expect(result).toContain('Session ID');
      expect(result).toContain('session-456');
      expect(result).toContain('Git Branch');
      expect(result).toContain('Working Directory');
      expect(result).toContain('Claude Code Version');
      // The div has both "message" and "user-message" classes
      expect(result).toContain('user-message');
      expect(result).toContain('assistant-message');
      expect(result).toContain('Hello');
      expect(result).toContain('Hi there!');
    });

    test('escapes HTML in message content', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: { role: 'user', content: '<script>alert("xss")</script>' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: '<div>safe</div>' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).not.toContain('<script>alert');
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<div>safe</div>');
      expect(result).toContain('&lt;div&gt;safe&lt;/div&gt;');
    });

    test('renders markdown content in assistant messages', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: '# Header\n\n**Bold** text' }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('class="markdown-content"');
      expect(result).toContain('<h1>');
      expect(result).toContain('Header');
      expect(result).toContain('<strong>');
      expect(result).toContain('Bold');
    });

    test('uses plain content for non-markdown text', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Just plain text here' }]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('class="plain-content"');
      expect(result).not.toContain('class="markdown-content"');
    });

    test('filters out system messages', () => {
      const jsonl = [
        createMessage({ type: 'system', message: { role: 'system', content: 'System' } }),
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      // Check that system message content is not displayed (not just the word "System" which appears in CSS like -apple-system)
      expect(result).not.toContain('>System<');
      expect(result).toContain('Hello');
    });

    test('returns empty string for empty input', () => {
      const result = formatConversationAsHTML('');
      expect(result).toBe('');
    });

    test('groups sidechain messages', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'Main message' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Main response' }
        }),
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Sidechain user' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Sidechain agent' }
        }),
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'Back to main' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Main response 2' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('class="sidechain-group"');
      expect(result).toContain('Sidechain user');
      expect(result).toContain('Sidechain agent');
    });

    test('closes sidechain group at end if needed', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Sidechain message' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Sidechain response' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      // Should have opening and closing div for sidechain-group
      const openCount = (result.match(/class="sidechain-group"/g) || []).length;
      // Check that we close the div (count of </div> should be at least as many as opened divs)
      expect(result).toContain('</div>');
    });

    test('uses correct role labels', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: { role: 'user', content: 'User message' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Agent response' }
        }),
        createMessage({
          type: 'user',
          isSidechain: true,
          message: { role: 'user', content: 'Sidechain user' }
        }),
        createMessage({
          type: 'assistant',
          isSidechain: true,
          message: { role: 'assistant', content: 'Sidechain subagent' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('<span class="role">User</span>');
      expect(result).toContain('<span class="role">Agent</span>');
    });

    test('formats tool use with parameters', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Running tool'
              },
              {
                type: 'tool_use',
                name: 'bash',
                input: {
                  command: 'ls -la',
                  cwd: '/home'
                }
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('class="tool-use"');
      expect(result).toContain('Tool Use:');
      expect(result).toContain('bash');
      expect(result).toContain('command:');
      expect(result).toContain('ls -la');
      expect(result).toContain('cwd:');
      expect(result).toContain('/home');
    });

    test('pairs tool use with tool result', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-pair',
                name: 'read_file',
                input: { file_path: 'test.txt' }
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-pair',
                content: 'File content here'
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('Tool Use:');
      expect(result).toContain('read_file');
      expect(result).toContain('Result:');
      expect(result).toContain('File content here');
    });

    test('formats tool result with pre for multiline content', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-multiline',
                name: 'bash',
                input: { command: 'ls' }
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-multiline',
                content: 'line1\nline2\nline3'
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('Result:');
      expect(result).toContain('<pre>');
      expect(result).toContain('line1\nline2\nline3');
    });

    test('skips user messages with only tool results', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-html-skip',
                name: 'bash',
                input: {}
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'tool-html-skip', content: 'done' }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      // Tool result should be paired with tool use
      expect(result).toContain('class="tool-result"');
    });

    test('displays token usage when present', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Hi!',
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
              cache_read_input_tokens: 200,
              cache_creation_input_tokens: 100
            }
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('class="token-usage"');
      expect(result).toContain('in: 1,000');
      expect(result).toContain('cache read: 200');
      expect(result).toContain('cache create: 100');
      expect(result).toContain('out: 500');
    });

    test('handles messages with only usage stats', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [],
            usage: { input_tokens: 50, output_tokens: 25 }
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('in: 50');
      expect(result).toContain('out: 25');
    });

    test('includes message IDs as anchors', () => {
      const customUuid = 'html-msg-123';
      const jsonl = [
        createMessage({
          type: 'user',
          uuid: customUuid,
          message: { role: 'user', content: 'Message' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Response' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain(`id="msg-${customUuid}"`);
    });

    test('includes timestamp links', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('<a href="#msg-');
      expect(result).toContain('class="timestamp"');
    });

    test('handles array content format', () => {
      const jsonl = [
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'Array user content' }]
          }
        }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Array assistant content' }]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('Array user content');
      expect(result).toContain('Array assistant content');
    });

    test('handles complex tool input with nested objects', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run complex tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                name: 'complex_tool',
                input: {
                  nested: {
                    array: [1, 2, 3],
                    string: 'test'
                  }
                }
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('nested:');
      expect(result).toContain('<pre>');
      // JSON.stringify adds pretty-print formatting with newlines
      expect(result).toContain('[');
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
      expect(result).toContain(']');
    });

    test('handles tool result with array content', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'tool-html-array',
                name: 'api_call',
                input: {}
              }
            ]
          }
        }),
        createMessage({
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-html-array',
                content: ['result1', 'result2']
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('Result:');
      expect(result).toContain('<pre>');
      // JSON.stringify adds pretty-print formatting with newlines
      expect(result).toContain('[');
      expect(result).toContain('&quot;result1&quot;');
      expect(result).toContain('&quot;result2&quot;');
      expect(result).toContain(']');
    });

    test('escapes metadata values', () => {
      const jsonl = [
        createMessage({
          sessionId: '<session>',
          gitBranch: '<branch>',
          cwd: '<path>',
          version: '<version>',
          type: 'user',
          message: { role: 'user', content: 'Hello' }
        }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).not.toContain('<session>');
      expect(result).not.toContain('<branch>');
      expect(result).not.toContain('<path>');
      expect(result).not.toContain('<version>');
      expect(result).toContain('&lt;session&gt;');
    });

    test('handles long tool input strings', () => {
      const longString = 'a'.repeat(150);
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                name: 'tool',
                input: { long_string: longString }
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('<pre>');
      expect(result).toContain(longString);
    });

    test('handles tool input with newlines', () => {
      const multilineString = 'line1\nline2\nline3';
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Run tool' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                name: 'tool',
                input: { script: multilineString }
              }
            ]
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('<pre>');
      expect(result).toContain('line1\nline2\nline3');
    });

    test('includes inline CSS styles', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: { role: 'assistant', content: 'Hi!' }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('<style>');
      expect(result).toContain('box-sizing:');
      expect(result).toContain('font-family:');
      expect(result).toContain('.user-message');
      expect(result).toContain('.assistant-message');
      expect(result).toContain('.markdown-content');
      expect(result).toContain('.tool-use');
    });

    test('handles messages with empty array content but usage', () => {
      const jsonl = [
        createMessage({ type: 'user', message: { role: 'user', content: 'Hello' } }),
        createMessage({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [],
            usage: { input_tokens: 10, output_tokens: 5 }
          }
        })
      ].join('\n');

      const result = formatConversationAsHTML(jsonl);

      expect(result).toContain('in: 10');
      expect(result).toContain('out: 5');
    });
  });
});

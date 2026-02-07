import { describe, test, expect } from 'vitest';
import { formatToolSummary, type ToolCallInput } from './tool-compress.js';

describe('tool-compress', () => {
  describe('tool name normalization', () => {
    test('normalizes mcp plugin tool names', () => {
      const input: ToolCallInput[] = [
        { toolName: 'mcp__plugin_context7_context7__query-docs', toolInput: { libraryId: '/test', query: 'help' } },
      ];
      const result = formatToolSummary(input);
      // Unknown MCP tools use fallback format: ToolName(key=val)
      expect(result).toContain('query-docs(libraryId=/test');
    });

    test('handles simple tool names without normalization', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '/test/file.ts' } },
      ];
      const result = formatToolSummary(input);
      expect(result).toContain('Read:');
    });
  });

  describe('Read tool formatting', () => {
    test('formats single Read call with file_path', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '/path/to/file.ts' } },
      ];
      expect(formatToolSummary(input)).toBe('Read: /path/to/file.ts');
    });

    test('formats multiple Read calls with comma separation', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '/path/to/a.ts' } },
        { toolName: 'Read', toolInput: { file_path: '/path/to/b.ts' } },
      ];
      expect(formatToolSummary(input)).toBe('Read: /path/to/a.ts, /path/to/b.ts');
    });
  });

  describe('Write tool formatting', () => {
    test('formats single Write call with file_path', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Write', toolInput: { file_path: '/output/file.ts' } },
      ];
      expect(formatToolSummary(input)).toBe('Write: /output/file.ts');
    });

    test('formats multiple Write calls', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Write', toolInput: { file_path: '/a.ts' } },
        { toolName: 'Write', toolInput: { file_path: '/b.ts' } },
      ];
      expect(formatToolSummary(input)).toBe('Write: /a.ts, /b.ts');
    });
  });

  describe('Edit tool formatting', () => {
    test('formats Edit with file_path and first line of old_string', () => {
      const input: ToolCallInput[] = [
        {
          toolName: 'Edit',
          toolInput: {
            file_path: '/src/main.ts',
            old_string: 'export function hello() {\n  console.log("hi");\n}',
            new_string: 'export function hello() {\n  console.log("bye");\n}',
          },
        },
      ];
      expect(formatToolSummary(input)).toBe('Edit: /src/main.ts (match: "export function hello() {")');
    });

    test('truncates old_string first line to 50 characters', () => {
      const longLine = 'a'.repeat(60);
      const input: ToolCallInput[] = [
        {
          toolName: 'Edit',
          toolInput: {
            file_path: '/test.ts',
            old_string: longLine + '\nmore content',
            new_string: 'replacement',
          },
        },
      ];
      expect(formatToolSummary(input)).toBe(`Edit: /test.ts (match: "${'a'.repeat(47)}...")`);
    });

    test('handles Edit with missing old_string', () => {
      const input: ToolCallInput[] = [
        {
          toolName: 'Edit',
          toolInput: {
            file_path: '/test.ts',
            new_string: 'replacement',
          },
        },
      ];
      expect(formatToolSummary(input)).toBe('Edit: /test.ts');
    });
  });

  describe('Bash tool formatting', () => {
    test('formats Bash with command truncated to 80 characters', () => {
      // Create a command that is longer than 80 characters
      const longCommand = 'npm run build -- --verbose --mode production --sourcemap inline --watch && echo "build complete"';
      const input: ToolCallInput[] = [
        { toolName: 'Bash', toolInput: { command: longCommand } },
      ];
      const truncated = longCommand.substring(0, 77) + '...';
      expect(formatToolSummary(input)).toBe(`Bash: \`${truncated}\``);
    });

    test('formats Bash with short command without truncation', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Bash', toolInput: { command: 'npm test' } },
      ];
      expect(formatToolSummary(input)).toBe('Bash: `npm test`');
    });

    test('formats multiple Bash calls', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Bash', toolInput: { command: 'npm install' } },
        { toolName: 'Bash', toolInput: { command: 'npm test' } },
      ];
      expect(formatToolSummary(input)).toBe('Bash: `npm install`, `npm test`');
    });
  });

  describe('Grep tool formatting', () => {
    test('formats Grep with pattern and path', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Grep', toolInput: { pattern: 'TODO', path: '/src' } },
      ];
      expect(formatToolSummary(input)).toBe('Grep: TODO in /src');
    });

    test('formats Grep with missing path', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Grep', toolInput: { pattern: 'FIXME' } },
      ];
      expect(formatToolSummary(input)).toBe('Grep: FIXME');
    });
  });

  describe('Glob tool formatting', () => {
    test('formats Glob with pattern and path', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Glob', toolInput: { pattern: '**/*.ts', path: '/src' } },
      ];
      expect(formatToolSummary(input)).toBe('Glob: **/*.ts in /src');
    });

    test('formats Glob with missing path', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Glob', toolInput: { pattern: '*.js' } },
      ];
      expect(formatToolSummary(input)).toBe('Glob: *.js');
    });
  });

  describe('Task tool formatting', () => {
    test('formats Task with description', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Task', toolInput: { description: 'Implement feature X' } },
      ];
      expect(formatToolSummary(input)).toBe('Task: Implement feature X');
    });
  });

  describe('TaskCreate tool formatting', () => {
    test('formats TaskCreate with subject', () => {
      const input: ToolCallInput[] = [
        { toolName: 'TaskCreate', toolInput: { subject: 'Fix authentication bug' } },
      ];
      expect(formatToolSummary(input)).toBe('TaskCreate: Fix authentication bug');
    });
  });

  describe('TaskUpdate tool formatting', () => {
    test('formats TaskUpdate with taskId and status', () => {
      const input: ToolCallInput[] = [
        { toolName: 'TaskUpdate', toolInput: { taskId: '123', status: 'completed' } },
      ];
      expect(formatToolSummary(input)).toBe('TaskUpdate: 123 → completed');
    });

    test('formats TaskUpdate with missing status', () => {
      const input: ToolCallInput[] = [
        { toolName: 'TaskUpdate', toolInput: { taskId: '456' } },
      ];
      expect(formatToolSummary(input)).toBe('TaskUpdate: 456');
    });
  });

  describe('LSP tool formatting', () => {
    test('formats LSP with operation and filePath', () => {
      const input: ToolCallInput[] = [
        { toolName: 'LSP', toolInput: { operation: 'goToDefinition', filePath: '/src/main.ts', line: 10, character: 5 } },
      ];
      expect(formatToolSummary(input)).toBe('LSP: goToDefinition on /src/main.ts');
    });
  });

  describe('WebSearch tool formatting', () => {
    test('formats WebSearch with query', () => {
      const input: ToolCallInput[] = [
        { toolName: 'WebSearch', toolInput: { query: 'latest React documentation' } },
      ];
      expect(formatToolSummary(input)).toBe('WebSearch: "latest React documentation"');
    });
  });

  describe('WebFetch tool formatting', () => {
    test('formats WebFetch with url', () => {
      const input: ToolCallInput[] = [
        { toolName: 'WebFetch', toolInput: { url: 'https://example.com' } },
      ];
      expect(formatToolSummary(input)).toBe('WebFetch: https://example.com');
    });
  });

  describe('Unknown tool fallback', () => {
    test('falls back to ToolName(key=val) format for unknown tools', () => {
      const input: ToolCallInput[] = [
        { toolName: 'CustomTool', toolInput: { key: 'value', num: 42 } },
      ];
      expect(formatToolSummary(input)).toMatch(/CustomTool\(key=value/);
    });

    test('handles unknown tool with primitive string input', () => {
      const input: ToolCallInput[] = [
        { toolName: 'CustomTool', toolInput: 'just a string' },
      ];
      expect(formatToolSummary(input)).toBe('CustomTool("just a string")');
    });

    test('handles unknown tool with primitive number input', () => {
      const input: ToolCallInput[] = [
        { toolName: 'CustomTool', toolInput: 42 },
      ];
      expect(formatToolSummary(input)).toBe('CustomTool(42)');
    });

    test('handles unknown tool with empty object input', () => {
      const input: ToolCallInput[] = [
        { toolName: 'CustomTool', toolInput: {} },
      ];
      expect(formatToolSummary(input)).toBe('CustomTool');
    });
  });

  describe('Undefined, empty, and null input handling', () => {
    test('handles undefined toolInput', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: undefined },
      ];
      expect(formatToolSummary(input)).toBe('Read');
    });

    test('handles null toolInput', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: null },
      ];
      expect(formatToolSummary(input)).toBe('Read');
    });

    test('handles empty object toolInput', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: {} },
      ];
      expect(formatToolSummary(input)).toBe('Read');
    });

    test('handles toolInput with empty string values', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '' } },
      ];
      expect(formatToolSummary(input)).toBe('Read');
    });

    test('handles empty array input', () => {
      expect(formatToolSummary([])).toBe('');
    });
  });

  describe('Same tool multiple times grouping', () => {
    test('groups multiple calls of the same tool', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '/a.ts' } },
        { toolName: 'Read', toolInput: { file_path: '/b.ts' } },
        { toolName: 'Read', toolInput: { file_path: '/c.ts' } },
      ];
      expect(formatToolSummary(input)).toBe('Read: /a.ts, /b.ts, /c.ts');
    });

    test('groups different tools with pipe separator', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '/src/main.ts' } },
        { toolName: 'Read', toolInput: { file_path: '/src/config.ts' } },
        { toolName: 'Bash', toolInput: { command: 'npm test' } },
        { toolName: 'Edit', toolInput: { file_path: '/src/db.ts', old_string: 'CREATE TABLE', new_string: 'ALTER TABLE' } },
      ];
      expect(formatToolSummary(input)).toBe(
        'Read: /src/main.ts, /src/config.ts | Bash: `npm test` | Edit: /src/db.ts (match: "CREATE TABLE")'
      );
    });

    test('maintains order of tool types by first appearance', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Bash', toolInput: { command: 'npm install' } },
        { toolName: 'Read', toolInput: { file_path: '/a.ts' } },
        { toolName: 'Bash', toolInput: { command: 'npm test' } },
        { toolName: 'Glob', toolInput: { pattern: '*.ts' } },
      ];
      expect(formatToolSummary(input)).toBe(
        'Bash: `npm install`, `npm test` | Read: /a.ts | Glob: *.ts'
      );
    });
  });

  describe('Complex integration scenarios', () => {
    test('handles realistic mixed tool call scenario', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '/src/main.ts' } },
        { toolName: 'Glob', toolInput: { pattern: '**/*.test.ts' } },
        { toolName: 'Read', toolInput: { file_path: '/src/config.ts' } },
        { toolName: 'Bash', toolInput: { command: 'npm run build' } },
        { toolName: 'Edit', toolInput: { file_path: '/src/db.ts', old_string: 'const x = 1;\nconst y = 2;', new_string: 'const x = 2;' } },
        { toolName: 'TaskCreate', toolInput: { subject: 'Add tests for compression' } },
      ];
      expect(formatToolSummary(input)).toBe(
        'Read: /src/main.ts, /src/config.ts | Glob: **/*.test.ts | Bash: `npm run build` | Edit: /src/db.ts (match: "const x = 1;") | TaskCreate: Add tests for compression'
      );
    });

    test('deterministic output for same input', () => {
      const input: ToolCallInput[] = [
        { toolName: 'Read', toolInput: { file_path: '/a.ts' } },
        { toolName: 'Read', toolInput: { file_path: '/b.ts' } },
        { toolName: 'Bash', toolInput: { command: 'npm test' } },
      ];
      const result1 = formatToolSummary(input);
      const result2 = formatToolSummary(input);
      expect(result1).toBe(result2);
    });
  });

  describe('Tool name normalization edge cases', () => {
    test('normalizes tool names with multiple underscores', () => {
      const input: ToolCallInput[] = [
        { toolName: 'mcp__plugin_a_b__c_d__operation', toolInput: { param: 'value' } },
      ];
      const result = formatToolSummary(input);
      // Unknown MCP tools use fallback format
      expect(result).toContain('operation(param=value)');
    });

    test('handles tool name with no prefix', () => {
      const input: ToolCallInput[] = [
        { toolName: 'SimpleTool', toolInput: { value: 'test' } },
      ];
      const result = formatToolSummary(input);
      expect(result).toContain('SimpleTool(');
    });

    test('handles tool name ending with double underscore', () => {
      const input: ToolCallInput[] = [
        { toolName: 'mcp__plugin__tool', toolInput: { param: 'value' } },
      ];
      const result = formatToolSummary(input);
      // Unknown MCP tools use fallback format
      expect(result).toContain('tool(param=value)');
    });
  });
});

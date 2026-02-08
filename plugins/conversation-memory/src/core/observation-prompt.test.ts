import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildInitPrompt,
  buildObservationPrompt,
  buildSummaryPrompt,
  parseObservationResponse,
  parseSummaryResponse,
  isLowValueTool,
  generateId,
  configureSkipTools,
  getDefaultSkipTools
} from './observation-prompt.js';
import type { Observation, SessionSummary } from './types.js';

describe('observation-prompt', () => {
  describe('buildInitPrompt', () => {
    it('should build initial system prompt without <system> tag', () => {
      const prompt = buildInitPrompt();
      expect(prompt).not.toContain('<system>');
      expect(prompt).toContain('Observer AI');
      expect(prompt).toContain('Observation types:');
    });

    it('should include skip guidance', () => {
      const prompt = buildInitPrompt();
      expect(prompt).toContain('WHEN TO SKIP');
      expect(prompt).toContain('Empty status checks');
      expect(prompt).toContain('Simple file listings');
      expect(prompt).toContain('Repetitive operations');
    });

    it('should include observation format instructions', () => {
      const prompt = buildInitPrompt();
      expect(prompt).toContain('Observation format:');
      expect(prompt).toContain('Always respond with valid XML');
    });

    it('should include response format with skip option', () => {
      const prompt = buildInitPrompt();
      expect(prompt).toContain('<skip>');
      expect(prompt).toContain('<observation>');
    });
  });

  describe('buildObservationPrompt', () => {
    it('should build observation prompt for tool use', () => {
      const prompt = buildObservationPrompt(
        'Read',
        { file_path: '/path/to/file.txt' },
        'File content',
        '/cwd',
        'myproject'
      );

      expect(prompt).toContain('<tool_event>');
      expect(prompt).toContain('<tool_name>Read</tool_name>');
      expect(prompt).toContain('/path/to/file.txt');
      expect(prompt).toContain('myproject');
    });

    it('should not include previous_context (removed in stateless refactor)', () => {
      const prompt = buildObservationPrompt(
        'Read',
        { file_path: '/path/to/file.txt' },
        'File content',
        '/cwd',
        'myproject'
      );

      expect(prompt).not.toContain('<previous_context>');
    });

    it('should only contain tool_event XML (analysis instructions moved to buildInitPrompt)', () => {
      const prompt = buildObservationPrompt(
        'Bash',
        { command: 'ls -la' },
        'file1.txt\nfile2.txt',
        '/home/user/project',
        'myproject'
      );

      // Should contain the tool_event
      expect(prompt).toContain('<tool_event>');
      expect(prompt).toContain('<tool_name>Bash</tool_name>');

      // Should not contain analysis instructions (they're in buildInitPrompt now)
      expect(prompt).not.toContain('Analyze this tool execution');
      expect(prompt).not.toContain('low-value tool');
    });

    it('should accept new signature without previousContext parameter', () => {
      // This test verifies the new signature works
      const prompt = buildObservationPrompt(
        'Edit',
        { file_path: '/path/to/file.ts', old_string: 'foo', new_string: 'bar' },
        'Edit successful',
        '/workspace',
        'test-project'
      );

      expect(prompt).toContain('<tool_name>Edit</tool_name>');
      expect(prompt).toContain('/workspace');
      expect(prompt).toContain('test-project');
    });
  });

  describe('buildSummaryPrompt', () => {
    it('should build summary prompt', () => {
      const prompt = buildSummaryPrompt(
        'Session context here',
        'myproject'
      );

      expect(prompt).toContain('<session_context>');
      expect(prompt).toContain('Session context here');
      expect(prompt).toContain('myproject');
      expect(prompt).toContain('session_summary');
    });
  });

  describe('parseObservationResponse', () => {
    it('should parse observation XML', () => {
      const xml = `
        <observation>
          <type>bugfix</type>
          <title>Fixed parsing bug</title>
          <subtitle>Parser now handles edge cases</subtitle>
          <narrative>Fixed the parser to handle edge cases</narrative>
          <facts><item>Fact 1</item><item>Fact 2</item></facts>
          <concepts><item>parsing</item><item>regex</item></concepts>
          <files_read><item>src/parser.ts</item></files_read>
          <files_modified><item>src/parser.ts</item></files_modified>
        </observation>
      `;

      const result = parseObservationResponse(xml);

      expect(result.type).toBe('observation');
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Fixed parsing bug');
      expect(result.data?.type).toBe('bugfix');
      expect(result.data?.facts).toEqual(['Fact 1', 'Fact 2']);
      expect(result.data?.concepts).toEqual(['parsing', 'regex']);
    });

    it('should parse skip XML', () => {
      const xml = '<skip><reason>Low value tool</reason></skip>';

      const result = parseObservationResponse(xml);

      expect(result.type).toBe('skip');
      expect(result.reason).toBe('Low value tool');
    });

    it('should handle unparseable responses', () => {
      const result = parseObservationResponse('invalid xml');

      expect(result.type).toBe('skip');
      expect(result.reason).toBe('Failed to parse response');
    });
  });

  describe('parseSummaryResponse', () => {
    it('should parse session summary XML', () => {
      const xml = `
        <session_summary>
          <request>Fix the parser bug</request>
          <investigated><item>Parser code</item></investigated>
          <learned><item>Regex patterns</item></learned>
          <completed><item>Fixed parser</item></completed>
          <next_steps><item>Add tests</item></next_steps>
          <notes>Need more tests</notes>
        </session_summary>
      `;

      const result = parseSummaryResponse(xml, 'session123', 'myproject');

      expect(result).toBeDefined();
      expect(result?.request).toBe('Fix the parser bug');
      expect(result?.sessionId).toBe('session123');
      expect(result?.project).toBe('myproject');
      expect(result?.investigated).toEqual(['Parser code']);
      expect(result?.learned).toEqual(['Regex patterns']);
      expect(result?.completed).toEqual(['Fixed parser']);
      expect(result?.nextSteps).toEqual(['Add tests']);
      expect(result?.notes).toBe('Need more tests');
    });

    it('should return null for invalid XML', () => {
      const result = parseSummaryResponse('invalid xml', 'session123', 'myproject');
      expect(result).toBeNull();
    });
  });

  describe('isLowValueTool', () => {
    it('should identify low-value tools including Todo, Task, Glob, LSP', () => {
      expect(isLowValueTool('TodoWrite')).toBe(true);
      expect(isLowValueTool('TodoRead')).toBe(true);
      expect(isLowValueTool('TaskCreate')).toBe(true);
      expect(isLowValueTool('TaskUpdate')).toBe(true);
      expect(isLowValueTool('TaskList')).toBe(true);
      expect(isLowValueTool('TaskGet')).toBe(true);
      expect(isLowValueTool('Glob')).toBe(true);
      expect(isLowValueTool('LSP')).toBe(true);
    });

    it('should not flag high-value tools', () => {
      expect(isLowValueTool('Read')).toBe(false);
      expect(isLowValueTool('Edit')).toBe(false);
      expect(isLowValueTool('Bash')).toBe(false);
      expect(isLowValueTool('Write')).toBe(false);
    });
  });

  describe('getDefaultSkipTools', () => {
    it('should return array of default skip tools', () => {
      const tools = getDefaultSkipTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toContain('TodoWrite');
      expect(tools).toContain('TodoRead');
      expect(tools).toContain('TaskCreate');
      expect(tools).toContain('TaskUpdate');
      expect(tools).toContain('TaskList');
      expect(tools).toContain('TaskGet');
      expect(tools).toContain('Glob');
      expect(tools).toContain('LSP');
    });

    it('should return a copy (not the internal array)', () => {
      const tools1 = getDefaultSkipTools();
      const tools2 = getDefaultSkipTools();
      expect(tools1).not.toBe(tools2);
    });
  });

  describe('configureSkipTools', () => {
    const originalDefaultSkipTools = [...getDefaultSkipTools()];

    afterEach(() => {
      // Restore default after each test
      configureSkipTools(originalDefaultSkipTools);
    });

    it('should replace the default skip tools', () => {
      configureSkipTools(['CustomTool1', 'CustomTool2']);
      expect(isLowValueTool('CustomTool1')).toBe(true);
      expect(isLowValueTool('CustomTool2')).toBe(true);
      expect(isLowValueTool('TodoWrite')).toBe(false); // No longer in list
    });

    it('should accept empty array to disable all skip tools', () => {
      configureSkipTools([]);
      expect(isLowValueTool('TodoWrite')).toBe(false);
      expect(isLowValueTool('TaskCreate')).toBe(false);
      expect(isLowValueTool('Glob')).toBe(false);
    });

    it('should not affect getDefaultSkipTools return value', () => {
      const before = getDefaultSkipTools();
      configureSkipTools(['OnlyTool']);
      const after = getDefaultSkipTools();

      // getDefaultSkipTools should still return the original defaults
      expect(before).toEqual(after);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with timestamp prefix', () => {
      const id = generateId();
      const timestamp = Date.now().toString();

      expect(id).toMatch(/^\d+-/);
      expect(id.startsWith(timestamp.substring(0, 10))).toBe(true);
    });
  });
});

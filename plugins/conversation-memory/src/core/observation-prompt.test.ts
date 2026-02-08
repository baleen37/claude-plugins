import { describe, it, expect } from 'vitest';
import {
  buildInitPrompt,
  buildObservationPrompt,
  buildSummaryPrompt,
  parseObservationResponse,
  parseSummaryResponse,
  isLowValueTool,
  generateId
} from './observation-prompt.js';
import type { Observation, SessionSummary } from './types.js';

describe('observation-prompt', () => {
  describe('buildInitPrompt', () => {
    it('should build initial system prompt', () => {
      const prompt = buildInitPrompt();
      expect(prompt).toContain('<system>');
      expect(prompt).toContain('Observer AI');
      expect(prompt).toContain('Observation types:');
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

    it('should include previous context when provided', () => {
      const prompt = buildObservationPrompt(
        'Read',
        { file_path: '/path/to/file.txt' },
        'File content',
        '/cwd',
        'myproject',
        'Previous observation: Fixed bug in parser'
      );

      expect(prompt).toContain('<previous_context>');
      expect(prompt).toContain('Previous observation: Fixed bug in parser');
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
    it('should identify low-value tools', () => {
      expect(isLowValueTool('TodoWrite')).toBe(true);
      expect(isLowValueTool('TodoRead')).toBe(true);
      expect(isLowValueTool('TaskCreate')).toBe(true);
      expect(isLowValueTool('TaskUpdate')).toBe(true);
      expect(isLowValueTool('TaskList')).toBe(true);
      expect(isLowValueTool('TaskGet')).toBe(true);
    });

    it('should not flag high-value tools', () => {
      expect(isLowValueTool('Read')).toBe(false);
      expect(isLowValueTool('Edit')).toBe(false);
      expect(isLowValueTool('Bash')).toBe(false);
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

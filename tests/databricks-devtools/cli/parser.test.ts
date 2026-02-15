/**
 * Tests for CLI output parser
 */

import { describe, it, expect } from 'vitest';
import { parseJsonOutput, parseTableOutput, parsePsqlOutput } from '../../src/cli/parser.js';

describe('parseJsonOutput', () => {
  it('should parse JSON output', () => {
    const json = '{"key": "value", "number": 42}';
    const result = parseJsonOutput<{ key: string; number: number }>(json);

    expect(result.key).toBe('value');
    expect(result.number).toBe(42);
  });

  it('should parse JSON array output', () => {
    const json = '[{"id": 1}, {"id": 2}]';
    const result = parseJsonOutput<Array<{ id: number }>>(json);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseJsonOutput('not json')).toThrow();
  });
});

describe('parseTableOutput', () => {
  it('should parse simple table with dashed separator', () => {
    const output = `
Name    | Value
--------|------
test    | 123
example | 456
`;
    const result = parseTableOutput(output);

    expect(result).toHaveLength(2);
    expect(result[0].Name).toBe('test');
    expect(result[0].Value).toBe('123');
    expect(result[1].Name).toBe('example');
    expect(result[1].Value).toBe('456');
  });

  it('should handle table without separator line', () => {
    const output = `a | b
1 | 2`;
    const result = parseTableOutput(output);

    expect(result).toHaveLength(1);
    expect(result[0].a).toBe('1');
    expect(result[0].b).toBe('2');
  });

  it('should handle empty output', () => {
    const result = parseTableOutput('');
    expect(result).toEqual([]);
  });
});

describe('parsePsqlOutput', () => {
  it('should parse psql table output', () => {
    const output = `
+-------+-------+
| col1  | col2  |
+-------+-------+
| val1  | val2  |
| val3  | val4  |
+-------+-------+
`;
    const result = parsePsqlOutput(output);

    expect(result.columns).toEqual(['col1', 'col2']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['val1', 'val2']);
    expect(result.rows[1]).toEqual(['val3', 'val4']);
  });

  it('should handle empty table', () => {
    const output = `
+------+------+
| col1 | col2 |
+------+------+
+------+------+
`;
    const result = parsePsqlOutput(output);

    expect(result.columns).toEqual(['col1', 'col2']);
    expect(result.rows).toHaveLength(0);
  });

  it('should handle output without table format', () => {
    const output = 'just plain text';
    const result = parsePsqlOutput(output);

    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
  });
});

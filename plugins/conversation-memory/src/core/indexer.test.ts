import { describe, test, expect } from 'vitest';

describe('File filtering for agent conversations', () => {
  test('filters out files starting with agent-', () => {
    const files = [
      'abc-123-def.jsonl',
      'agent-task-123.jsonl',
      'normal-conversation.jsonl',
      'agent-xyz.jsonl',
      'another-session.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([
      'abc-123-def.jsonl',
      'normal-conversation.jsonl',
      'another-session.jsonl',
    ]);
  });

  test('keeps files that have agent- in the middle but not at start', () => {
    const files = [
      'my-agent-conversation.jsonl',
      'reagent-analysis.jsonl',
      'agent-123.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([
      'my-agent-conversation.jsonl',
      'reagent-analysis.jsonl',
    ]);
  });

  test('filters out only .jsonl files', () => {
    const files = [
      'conversation.jsonl',
      'conversation.txt',
      'data.json',
      'agent-test.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([
      'conversation.jsonl',
    ]);
  });

  test('handles empty array', () => {
    const filtered = [].filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));
    expect(filtered).toEqual([]);
  });

  test('handles array with only agent files', () => {
    const files = [
      'agent-1.jsonl',
      'agent-2.jsonl',
      'agent-task.jsonl',
    ];

    const filtered = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'));

    expect(filtered).toEqual([]);
  });
});

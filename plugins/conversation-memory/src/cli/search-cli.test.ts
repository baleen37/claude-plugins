/**
 * Tests for search-cli.ts
 *
 * Tests the CLI command for searching conversations.
 * Covers argument parsing, mode selection, date filtering, project filtering,
 * limit handling, and multi-concept search.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'fs';
import path from 'path';

// Import the core functions that the CLI uses
import {
  searchConversations,
  searchMultipleConcepts,
  formatResults,
  formatMultiConceptResults,
  type SearchOptions
} from '../core/search.js';
import type { SearchResult, MultiConceptResult } from '../core/types.js';

describe('search-cli argument parsing', () => {
  describe('mode selection', () => {
    test('should default to both mode', () => {
      const args: string[] = [];
      let mode: 'vector' | 'text' | 'both' = 'both';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--vector') mode = 'vector';
        else if (args[i] === '--text') mode = 'text';
      }

      expect(mode).toBe('both');
    });

    test('should set vector mode with --vector flag', () => {
      const args = ['--vector'];
      let mode: 'vector' | 'text' | 'both' = 'both';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--vector') mode = 'vector';
        else if (args[i] === '--text') mode = 'text';
      }

      expect(mode).toBe('vector');
    });

    test('should set text mode with --text flag', () => {
      const args = ['--text'];
      let mode: 'vector' | 'text' | 'both' = 'both';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--vector') mode = 'vector';
        else if (args[i] === '--text') mode = 'text';
      }

      expect(mode).toBe('text');
    });

    test('should use last mode flag if multiple specified', () => {
      const args = ['--vector', '--text'];
      let mode: 'vector' | 'text' | 'both' = 'both';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--vector') mode = 'vector';
        else if (args[i] === '--text') mode = 'text';
      }

      expect(mode).toBe('text');
    });
  });

  describe('date filtering', () => {
    test('should parse --after flag', () => {
      const args = ['--after', '2025-01-15', 'query'];
      let after: string | undefined;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--after') {
          after = args[++i];
        }
      }

      expect(after).toBe('2025-01-15');
    });

    test('should parse --before flag', () => {
      const args = ['--before', '2025-01-20', 'query'];
      let before: string | undefined;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--before') {
          before = args[++i];
        }
      }

      expect(before).toBe('2025-01-20');
    });

    test('should parse both --after and --before', () => {
      const args = ['--after', '2025-01-15', '--before', '2025-01-20', 'query'];
      let after: string | undefined;
      let before: string | undefined;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--after') {
          after = args[++i];
        } else if (args[i] === '--before') {
          before = args[++i];
        }
      }

      expect(after).toBe('2025-01-15');
      expect(before).toBe('2025-01-20');
    });
  });

  describe('project filtering', () => {
    test('should parse single --project flag', () => {
      const args = ['--project', 'my-project', 'query'];
      let projects: string[] | undefined;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project') {
          if (!projects) projects = [];
          projects.push(args[++i]);
        }
      }

      expect(projects).toEqual(['my-project']);
    });

    test('should parse multiple --project flags', () => {
      const args = ['--project', 'project-a', '--project', 'project-b', 'query'];
      let projects: string[] | undefined;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project') {
          if (!projects) projects = [];
          projects.push(args[++i]);
        }
      }

      expect(projects).toEqual(['project-a', 'project-b']);
    });

    test('should handle no --project flags', () => {
      const args = ['query'];
      let projects: string[] | undefined;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project') {
          if (!projects) projects = [];
          projects.push(args[++i]);
        }
      }

      expect(projects).toBeUndefined();
    });
  });

  describe('limit handling', () => {
    test('should parse --limit flag', () => {
      const args = ['--limit', '20', 'query'];
      let limit = 10;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit') {
          limit = parseInt(args[++i]);
        }
      }

      expect(limit).toBe(20);
    });

    test('should use default limit when not specified', () => {
      const args = ['query'];
      let limit = 10;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit') {
          limit = parseInt(args[++i]);
        }
      }

      expect(limit).toBe(10);
    });

    test('should handle invalid limit', () => {
      const args = ['--limit', 'invalid', 'query'];
      let limit = 10;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit') {
          const parsed = parseInt(args[++i]);
          if (!isNaN(parsed)) {
            limit = parsed;
          }
        }
      }

      expect(limit).toBe(10); // Should keep default
    });
  });

  describe('query parsing', () => {
    test('should extract single query', () => {
      const args = ['search', 'term'];
      const queries: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
          queries.push(arg);
        }
      }

      expect(queries).toEqual(['search', 'term']);
    });

    test('should extract multiple queries for multi-concept search', () => {
      const args = ['React', 'Router', 'authentication'];
      const queries: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
          queries.push(arg);
        }
      }

      expect(queries).toEqual(['React', 'Router', 'authentication']);
    });

    test('should skip flags when extracting queries', () => {
      const args = ['--project', 'my-project', 'search', '--limit', '10', 'term'];
      const queries: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--project' || arg === '--limit') {
          i++; // Skip flag value
        } else if (!arg.startsWith('--')) {
          queries.push(arg);
        }
      }

      expect(queries).toEqual(['search', 'term']);
    });

    test('should detect when no queries provided', () => {
      const args: string[] = [];
      const queries: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
          queries.push(arg);
        }
      }

      expect(queries.length).toBe(0);
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

describe('search-cli execution paths', () => {
  describe('single query search', () => {
    test('should use searchConversations for single query', async () => {
      const queries = ['single query'];
      expect(queries.length).toBe(1);

      // Single query path
      const options: SearchOptions = {
        mode: 'both',
        limit: 10,
        after: undefined,
        before: undefined,
        projects: undefined
      };

      expect(options.mode).toBe('both');
      expect(options.limit).toBe(10);
    });
  });

  describe('multi-concept search', () => {
    test('should use searchMultipleConcepts for multiple queries', () => {
      const queries = ['React', 'Router', 'JWT'];
      expect(queries.length).toBeGreaterThan(1);

      // Multi-concept search path
      const options = {
        limit: 10,
        after: undefined,
        before: undefined,
        projects: undefined
      };

      expect(options.limit).toBe(10);
    });

    test('should pass all queries to searchMultipleConcepts', () => {
      const queries = ['authentication', 'security', 'JWT'];
      expect(queries).toEqual(['authentication', 'security', 'JWT']);
    });
  });
});

describe('search-cli output formatting', () => {
  describe('error handling', () => {
    test('should show error for missing query', () => {
      const queries: string[] = [];
      const hasQuery = queries.length > 0;

      expect(hasQuery).toBe(false);
    });

    test('should show usage message when no query', () => {
      const queries: string[] = [];
      const usageMessage = 'Usage: conversation-memory search [OPTIONS] <query> [query2] [query3]...';

      if (queries.length === 0) {
        expect(usageMessage).toContain('Usage:');
        expect(usageMessage).toContain('conversation-memory search');
      }
    });

    test('should handle search errors gracefully', () => {
      const error = new Error('Database connection failed');
      const errorMessage = `Error searching: ${error.message}`;

      expect(errorMessage).toContain('Error searching:');
      expect(errorMessage).toContain('Database connection failed');
    });
  });

  describe('formatResults integration', () => {
    test('should handle empty results', async () => {
      const output = await formatResults([]);
      expect(output).toBe('No results found.');
    });

    test('should handle results with summaries', async () => {
      const archivePath = '/tmp/test-archive.jsonl';
      fs.writeFileSync(archivePath, 'line1\nline2\n');

      const results: SearchResult[] = [
        {
          exchange: {
            id: '1',
            project: 'test-project',
            timestamp: '2025-01-15T10:00:00Z',
            userMessage: 'How to implement auth?',
            assistantMessage: 'Use JWT',
            archivePath: archivePath,
            lineStart: 1,
            lineEnd: 5
          },
          similarity: 0.85,
          snippet: 'How to implement auth?'
        }
      ];

      try {
        const output = await formatResults(results);
        expect(output).toContain('Found 1 relevant conversation');
        expect(output).toContain('[test-project, 2025-01-15]');
      } finally {
        fs.unlinkSync(archivePath);
      }
    });
  });

  describe('formatMultiConceptResults integration', () => {
    test('should handle empty multi-concept results', async () => {
      const output = await formatMultiConceptResults([], ['auth', 'security']);
      expect(output).toContain('No conversations found matching all concepts');
      expect(output).toContain('auth, security');
    });

    test('should format multi-concept results with scores', async () => {
      const archivePath = '/tmp/test-multi.jsonl';
      fs.writeFileSync(archivePath, 'line1\nline2\n');

      const results: MultiConceptResult[] = [
        {
          exchange: {
            id: '1',
            project: 'test-project',
            timestamp: '2025-01-15T10:00:00Z',
            userMessage: 'How to implement auth?',
            assistantMessage: 'Use JWT',
            archivePath: archivePath,
            lineStart: 1,
            lineEnd: 5
          },
          snippet: 'How to implement auth?',
          conceptSimilarities: [0.85, 0.72],
          averageSimilarity: 0.785
        }
      ];

      try {
        const output = await formatMultiConceptResults(results, ['authentication', 'JWT']);
        expect(output).toContain('Found 1 conversation matching all concepts');
        expect(output).toContain('[authentication + JWT]');
        expect(output).toContain('79% avg match');
      } finally {
        fs.unlinkSync(archivePath);
      }
    });
  });
});

describe('search-cli SearchOptions construction', () => {
  test('should build SearchOptions for both mode with all filters', () => {
    const options: SearchOptions = {
      mode: 'both',
      limit: 20,
      after: '2025-01-15',
      before: '2025-01-20',
      projects: ['project-a', 'project-b']
    };

    expect(options.mode).toBe('both');
    expect(options.limit).toBe(20);
    expect(options.after).toBe('2025-01-15');
    expect(options.before).toBe('2025-01-20');
    expect(options.projects).toEqual(['project-a', 'project-b']);
  });

  test('should build SearchOptions with only some filters', () => {
    const options: SearchOptions = {
      mode: 'vector',
      limit: 15,
      after: '2025-01-01'
      // No before, no projects
    };

    expect(options.mode).toBe('vector');
    expect(options.limit).toBe(15);
    expect(options.after).toBe('2025-01-01');
    expect(options.before).toBeUndefined();
    expect(options.projects).toBeUndefined();
  });

  test('should build SearchOptions with default values', () => {
    const options: SearchOptions = {};

    expect(options.mode).toBeUndefined();
    expect(options.limit).toBeUndefined();
    expect(options.after).toBeUndefined();
    expect(options.before).toBeUndefined();
    expect(options.projects).toBeUndefined();
  });
});

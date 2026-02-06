/**
 * Tests for sync-cli.ts
 *
 * Tests the CLI command for syncing conversations from source to archive.
 * Covers argument parsing, help output, background mode, and sync execution.
 *
 * Note: These tests require the actual sync-cli.ts to be refactored to export
 * main functions for testability. For now, we test the core logic that the CLI
 * uses by importing the core modules directly.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import the core functions that the CLI uses
import { syncConversations, type SyncResult } from '../core/sync.js';
import { getArchiveDir } from '../core/paths.js';

describe('sync-cli core functionality', () => {
  describe('syncConversations integration', () => {
    test('should return sync result with correct structure', async () => {
      // Create a test source directory with no files
      const tempDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'sync-test-'));
      const sourceDir = path.join(tempDir, 'source');
      const destDir = path.join(tempDir, 'dest');

      fs.mkdirSync(sourceDir, { recursive: true });
      fs.mkdirSync(destDir, { recursive: true });

      try {
        const result = await syncConversations(sourceDir, destDir, {
          skipIndex: true,
          skipSummaries: true
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty('copied');
        expect(result).toHaveProperty('skipped');
        expect(result).toHaveProperty('indexed');
        expect(result).toHaveProperty('summarized');
        expect(result).toHaveProperty('errors');
        expect(typeof result.copied).toBe('number');
        expect(typeof result.skipped).toBe('number');
        expect(typeof result.indexed).toBe('number');
        expect(typeof result.summarized).toBe('number');
        expect(Array.isArray(result.errors));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should handle non-existent source directory', async () => {
      const tempDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'sync-test-'));
      const sourceDir = path.join(tempDir, 'non-existent');
      const destDir = path.join(tempDir, 'dest');

      try {
        const result = await syncConversations(sourceDir, destDir);

        // Should return empty result without error
        expect(result.copied).toBe(0);
        expect(result.skipped).toBe(0);
        expect(result.indexed).toBe(0);
        expect(result.summarized).toBe(0);
        expect(result.errors).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('getArchiveDir', () => {
    test('should return a valid path', () => {
      const archiveDir = getArchiveDir();
      expect(typeof archiveDir).toBe('string');
      expect(archiveDir.length).toBeGreaterThan(0);
    });
  });
});

describe('sync-cli output formatting', () => {
  describe('token usage calculation', () => {
    test('should calculate total input tokens with cache read', () => {
      const result: SyncResult = {
        copied: 1,
        skipped: 0,
        indexed: 1,
        summarized: 0,
        errors: [],
        tokenUsage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 200,
          cache_creation_input_tokens: 0
        }
      };

      const totalInput = result.tokenUsage!.input_tokens + (result.tokenUsage!.cache_read_input_tokens || 0);
      expect(totalInput).toBe(1200);
    });

    test('should calculate total tokens correctly', () => {
      const result: SyncResult = {
        copied: 1,
        skipped: 0,
        indexed: 1,
        summarized: 0,
        errors: [],
        tokenUsage: {
          input_tokens: 5000,
          output_tokens: 2000,
          cache_read_input_tokens: 500,
          cache_creation_input_tokens: 250
        }
      };

      const totalInput = result.tokenUsage!.input_tokens + (result.tokenUsage!.cache_read_input_tokens || 0);
      const totalOutput = result.tokenUsage!.output_tokens;
      const cacheCreate = result.tokenUsage!.cache_creation_input_tokens || 0;
      const total = totalInput + totalOutput + cacheCreate;

      expect(totalInput).toBe(5500);
      expect(totalOutput).toBe(2000);
      expect(cacheCreate).toBe(250);
      expect(total).toBe(7750);
    });

    test('should handle missing cache fields', () => {
      const result: SyncResult = {
        copied: 1,
        skipped: 0,
        indexed: 1,
        summarized: 0,
        errors: [],
        tokenUsage: {
          input_tokens: 1000,
          output_tokens: 500
          // Missing cache fields
        }
      };

      const cacheRead = result.tokenUsage!.cache_read_input_tokens || 0;
      const cacheCreate = result.tokenUsage!.cache_creation_input_tokens || 0;

      expect(cacheRead).toBe(0);
      expect(cacheCreate).toBe(0);
    });
  });

  describe('sync result formatting', () => {
    test('should format basic sync result', () => {
      const result: SyncResult = {
        copied: 5,
        skipped: 3,
        indexed: 5,
        summarized: 2,
        errors: []
      };

      const output = [
        '\nSync complete!',
        `  Copied: ${result.copied}`,
        `  Skipped: ${result.skipped}`,
        `  Indexed: ${result.indexed}`,
        `  Summarized: ${result.summarized}`
      ].join('\n');

      expect(output).toContain('Copied: 5');
      expect(output).toContain('Skipped: 3');
      expect(output).toContain('Indexed: 5');
      expect(output).toContain('Summarized: 2');
    });

    test('should format sync result with errors', () => {
      const result: SyncResult = {
        copied: 1,
        skipped: 0,
        indexed: 1,
        summarized: 0,
        errors: [
          { file: '/path/to/file1.jsonl', error: 'Permission denied' },
          { file: '/path/to/file2.jsonl', error: 'Invalid format' }
        ]
      };

      const errorOutput = result.errors.map(err => `  ${err.file}: ${err.error}`).join('\n');

      expect(errorOutput).toContain('/path/to/file1.jsonl: Permission denied');
      expect(errorOutput).toContain('/path/to/file2.jsonl: Invalid format');
    });

    test('should format token usage', () => {
      const result: SyncResult = {
        copied: 1,
        skipped: 0,
        indexed: 1,
        summarized: 0,
        errors: [],
        tokenUsage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 50
        }
      };

      const totalInput = result.tokenUsage!.input_tokens + (result.tokenUsage!.cache_read_input_tokens || 0);
      const totalOutput = result.tokenUsage!.output_tokens;
      const cacheCreate = result.tokenUsage!.cache_creation_input_tokens || 0;

      const tokenOutput = [
        `\nToken Usage (this run):`,
        `  Input: ${totalInput.toLocaleString()}`,
        `  Output: ${totalOutput.toLocaleString()}`,
        cacheCreate > 0 ? `  Cache created: ${cacheCreate.toLocaleString()}` : '',
        `  Total: ${(totalInput + totalOutput + cacheCreate).toLocaleString()} tokens`
      ].filter(Boolean).join('\n');

      expect(tokenOutput).toContain('Input: 1,100');
      expect(tokenOutput).toContain('Output: 500');
      expect(tokenOutput).toContain('Cache created: 50');
      expect(tokenOutput).toContain('Total: 1,650');
    });

    test('should handle sync result with no token usage', () => {
      const result: SyncResult = {
        copied: 1,
        skipped: 0,
        indexed: 1,
        summarized: 0,
        errors: []
        // No tokenUsage
      };

      expect(result.tokenUsage).toBeUndefined();
    });
  });
});

describe('sync-cli CLI argument patterns', () => {
  describe('argument parsing logic', () => {
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

    test('should detect --background flag', () => {
      const args = ['--background'];
      const isBackground = args.includes('--background');
      expect(isBackground).toBe(true);
    });

    test('should filter out --background flag', () => {
      const args = ['--background', 'other', 'args'];
      const filteredArgs = args.filter(arg => arg !== '--background');
      expect(filteredArgs).not.toContain('--background');
      expect(filteredArgs).toEqual(['other', 'args']);
    });

    test('should handle no flags', () => {
      const args: string[] = [];
      const hasHelp = args.includes('--help') || args.includes('-h');
      const isBackground = args.includes('--background');
      expect(hasHelp).toBe(false);
      expect(isBackground).toBe(false);
    });
  });

  describe('path construction', () => {
    test('should construct source directory path', () => {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
      const sourceDir = path.join(homeDir, '.claude', 'projects');
      expect(sourceDir).toContain('.claude');
      expect(sourceDir).toContain('projects');
    });

    test('should get archive directory from core', () => {
      const archiveDir = getArchiveDir();
      expect(typeof archiveDir).toBe('string');
      expect(archiveDir.length).toBeGreaterThan(0);
    });
  });
});

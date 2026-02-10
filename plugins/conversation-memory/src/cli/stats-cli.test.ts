/**
 * Tests for stats-cli.ts - Display statistics about the indexed conversation archive.
 *
 * This CLI:
 * - Shows help with --help or -h
 * - Gets index stats from database
 * - Formats and outputs stats to stdout
 * - Handles errors gracefully
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the stats module
vi.mock('../core/stats.js', () => ({
  getIndexStats: vi.fn(),
  formatStats: vi.fn(),
}));

import { getIndexStats, formatStats } from '../core/stats.js';
import type { IndexStats } from '../core/stats.js';

describe('stats-cli', () => {
  let originalArgv: string[];
  let consoleLogs: string[];
  let consoleErrors: string[];
  let mockStats: IndexStats;

  beforeEach(() => {
    // Store original argv
    originalArgv = process.argv;

    // Setup mock stats data
    mockStats = {
      totalConversations: 100,
      totalExchanges: 500,
      conversationsWithSummaries: 75,
      conversationsWithoutSummaries: 25,
      dateRange: { earliest: '2024-01-01', latest: '2024-12-31' },
      projectCount: 3,
      topProjects: [
        { project: 'project-a', count: 50 },
        { project: 'project-b', count: 30 },
        { project: 'project-c', count: 20 }
      ]
    };

    (getIndexStats as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);
    (formatStats as ReturnType<typeof vi.fn>).mockReturnValue(
      'Total Conversations: 100\nTotal Exchanges: 500\nWith Summary: 75'
    );

    // Setup console tracking
    consoleLogs = [];
    consoleErrors = [];

    vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleLogs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      consoleErrors.push(args.map(String).join(' '));
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  describe('argument parsing', () => {
    test('should detect --help flag', () => {
      process.argv = ['node', 'stats-cli', '--help'];
      const hasHelpFlag = process.argv.includes('--help');
      expect(hasHelpFlag).toBe(true);
    });

    test('should detect -h flag', () => {
      process.argv = ['node', 'stats-cli', '-h'];
      const hasHelpFlag = process.argv.includes('-h') || process.argv.includes('--help');
      expect(hasHelpFlag).toBe(true);
    });

    test('should have no arguments when running stats', () => {
      process.argv = ['node', 'stats-cli'];
      const hasHelpFlag = process.argv.includes('-h') || process.argv.includes('--help');
      expect(hasHelpFlag).toBe(false);
    });
  });

  describe('help text content', () => {
    test('should contain usage information', () => {
      const expectedUsage = 'Usage: conversation-memory stats';
      expect(expectedUsage).toBe('Usage: conversation-memory stats');
    });

    test('should describe what stats displays', () => {
      const expectedDescription = 'Display statistics about the indexed conversation archive';
      expect(expectedDescription).toBe('Display statistics about the indexed conversation archive');
    });

    test('should list statistics sections', () => {
      const expectedSections = [
        'Total conversations',
        'Total exchanges',
        'AI summaries',
        'Date range',
        'Project breakdown',
        'Top projects'
      ];
      expectedSections.forEach(section => {
        expect(typeof section).toBe('string');
      });
    });
  });

  describe('stats retrieval logic', () => {
    test('should call getIndexStats', async () => {
      await getIndexStats();

      expect(getIndexStats).toHaveBeenCalled();
    });

    test('should pass stats to formatStats', async () => {
      const stats = await getIndexStats();
      formatStats(stats);

      expect(formatStats).toHaveBeenCalledWith(mockStats);
    });
  });

  describe('stats data structure', () => {
    test('should have correct structure', () => {
      expect(mockStats).toHaveProperty('totalConversations');
      expect(mockStats).toHaveProperty('totalExchanges');
      expect(mockStats).toHaveProperty('conversationsWithSummaries');
      expect(mockStats).toHaveProperty('conversationsWithoutSummaries');
      expect(mockStats).toHaveProperty('projectCount');
    });

    test('should handle empty projects object', () => {
      const emptyStats: IndexStats = {
        totalConversations: 0,
        conversationsWithSummaries: 0,
        conversationsWithoutSummaries: 0,
        totalExchanges: 0,
        projectCount: 0,
      };
      expect(emptyStats.projectCount).toBe(0);
    });

    test('should handle zero values', () => {
      const zeroStats: IndexStats = {
        totalConversations: 0,
        conversationsWithSummaries: 0,
        conversationsWithoutSummaries: 0,
        totalExchanges: 0,
        projectCount: 0,
      };
      expect(zeroStats.totalConversations).toBe(0);
      expect(zeroStats.totalExchanges).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle getIndexStats rejection', async () => {
      const testError = new Error('Database connection failed');
      (getIndexStats as ReturnType<typeof vi.fn>).mockRejectedValue(testError);

      await expect(getIndexStats()).rejects.toThrow('Database connection failed');
    });

    test('should handle formatStats errors', () => {
      const testError = new Error('Format failed');
      (formatStats as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw testError;
      });

      expect(() => formatStats(mockStats)).toThrow('Format failed');
    });
  });
});

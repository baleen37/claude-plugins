/**
 * Tests for MCP server
 */

import { describe, it, expect } from 'vitest';
import { listProfilesTool } from '../../src/mcp/server.js';

describe('MCP Server Tools', () => {
  describe('listProfilesTool', () => {
    it('should list profiles from config', async () => {
      // This is a simple smoke test
      // Full integration testing would require mocking the filesystem
      const result = await listProfilesTool();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});

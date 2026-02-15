/**
 * Tests for profiles.ts module
 */

import { describe, it, expect } from 'vitest';
import { getDefaultConfigPath } from '../src/config/profiles.js';

describe('getDefaultConfigPath', () => {
  it('should return ~/.databrickscfg path', () => {
    const path = getDefaultConfigPath();
    expect(path).toMatch(/\.databrickscfg$/);
    expect(path).not.toContain('~');
  });
});

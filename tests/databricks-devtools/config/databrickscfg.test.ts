/**
 * Tests for databrickscfg parser
 */

import { describe, it, expect } from 'vitest';
import { parseDatabricksConfigContent, type ProfileConfig } from '../../src/config/databrickscfg.js';

describe('parseDatabricksConfigContent', () => {
  it('should parse a simple profile', () => {
    const content = `
[default]
host = https://test.cloud.databricks.com
token = dapi123
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles).toHaveProperty('default');
    expect(result.profiles.default.host).toBe('https://test.cloud.databricks.com');
    expect(result.profiles.default.token).toBe('dapi123');
  });

  it('should parse multiple profiles', () => {
    const content = `
[alpha]
host = https://alpha.cloud.databricks.com

[beta]
host = https://beta.cloud.databricks.com
`;
    const result = parseDatabricksConfigContent(content);

    expect(Object.keys(result.profiles)).toHaveLength(2);
    expect(result.profiles.alpha.host).toBe('https://alpha.cloud.databricks.com');
    expect(result.profiles.beta.host).toBe('https://beta.cloud.databricks.com');
  });

  it('should skip DEFAULT section', () => {
    const content = `
[DEFAULT]

[default]
host = https://test.cloud.databricks.com
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles).not.toHaveProperty('DEFAULT');
    expect(result.profiles).toHaveProperty('default');
  });

  it('should skip comments', () => {
    const content = `
# This is a comment
[default]
host = https://test.cloud.databricks.com
; another comment
token = dapi123
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.default.host).toBe('https://test.cloud.databricks.com');
    expect(result.profiles.default.token).toBe('dapi123');
  });

  it('should handle key=value and key value formats', () => {
    const content = `
[default]
host = https://test.cloud.databricks.com
token dapi123
auth_type databricks-cli
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.default.host).toBe('https://test.cloud.databricks.com');
    expect(result.profiles.default.token).toBe('dapi123');
    expect(result.profiles.default.auth_type).toBe('databricks-cli');
  });

  it('should handle empty config', () => {
    const result = parseDatabricksConfigContent('');

    expect(result.profiles).toEqual({});
  });

  it('should handle config with only comments', () => {
    const content = `
# Comment 1
; Comment 2
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles).toEqual({});
  });
});

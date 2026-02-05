/**
 * Tests for databrickscfg.ts module
 */

import { describe, it, expect } from 'vitest';
import { parseDatabricksConfigContent } from '../src/config/databrickscfg.js';

describe('parseDatabricksConfigContent', () => {
  it('should parse basic profile config', () => {
    const content = `
[default]
host = https://dbc-0f9fb7d0-f284.cloud.databricks.com
token = dapi123

[alpha]
host = https://dbc-0f9fb7d0-f284.cloud.databricks.com
cluster_id = 0128-093554-2o0sbp4w
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.default).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      token: 'dapi123',
    });

    expect(result.profiles.alpha).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      cluster_id: '0128-093554-2o0sbp4w',
    });
  });

  it('should handle space-separated key values', () => {
    const content = `
[alpha]
host       = https://dbc-0f9fb7d0-f284.cloud.databricks.com
cluster_id = 0128-093554-2o0sbp4w
auth_type  = databricks-cli
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.alpha).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      cluster_id: '0128-093554-2o0sbp4w',
      auth_type: 'databricks-cli',
    });
  });

  it('should handle key without equals sign', () => {
    const content = `
[beta]
host      = https://dbc-0f9fb7d0-f284.cloud.databricks.com
auth_type databricks-cli
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.beta).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      auth_type: 'databricks-cli',
    });
  });

  it('should skip DEFAULT section', () => {
    const content = `
[DEFAULT]

[default]
host = https://example.com

[prod]
host = https://prod.example.com
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles).not.toHaveProperty('DEFAULT');
    expect(result.profiles.default).toEqual({
      host: 'https://example.com',
    });
    expect(result.profiles.prod).toEqual({
      host: 'https://prod.example.com',
    });
  });

  it('should skip comments', () => {
    const content = `
# This is a comment
[default]
; This is also a comment
host = https://example.com
# Inline comment not supported but line comment is
token = dapi123
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.default).toEqual({
      host: 'https://example.com',
      token: 'dapi123',
    });
  });

  it('should skip empty lines', () => {
    const content = `

[default]

host = https://example.com


token = dapi123

`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.default).toEqual({
      host: 'https://example.com',
      token: 'dapi123',
    });
  });

  it('should parse real-world config format', () => {
    const content = `
[DEFAULT]

[default]
host  = https://dbc-0f9fb7d0-f284.cloud.databricks.com
token = dapi0000000000000000000000000000000

[alpha]
host       = https://dbc-0f9fb7d0-f284.cloud.databricks.com
cluster_id = 0128-093554-2o0sbp4w
auth_type  = databricks-cli

[beta]
host      = https://dbc-0f9fb7d0-f284.cloud.databricks.com
auth_type = databricks-cli

[prod]
host      = https://dbc-0f9fb7d0-f284.cloud.databricks.com
auth_type = databricks-cli
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.default).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      token: 'dapi0000000000000000000000000000000',
    });

    expect(result.profiles.alpha).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      cluster_id: '0128-093554-2o0sbp4w',
      auth_type: 'databricks-cli',
    });

    expect(result.profiles.beta).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      auth_type: 'databricks-cli',
    });

    expect(result.profiles.prod).toEqual({
      host: 'https://dbc-0f9fb7d0-f284.cloud.databricks.com',
      auth_type: 'databricks-cli',
    });
  });

  it('should handle empty config', () => {
    const result = parseDatabricksConfigContent('');
    expect(result.profiles).toEqual({});
  });

  it('should handle arbitrary keys', () => {
    const content = `
[custom]
host = https://example.com
custom_field = custom_value
another_field = another_value
`;
    const result = parseDatabricksConfigContent(content);

    expect(result.profiles.custom).toEqual({
      host: 'https://example.com',
      custom_field: 'custom_value',
      another_field: 'another_value',
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../../src/cli/runner.js';
import { parseDatabricksConfig } from '../../src/config/databrickscfg.js';
import { getDefaultConfigPath } from '../../src/config/profiles.js';
import { executeSql, resolveWarehouse } from '../../src/sql/executor.js';

vi.mock('../../src/cli/runner.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('../../src/config/databrickscfg.js', () => ({
  parseDatabricksConfig: vi.fn(),
}));

vi.mock('../../src/config/profiles.js', () => ({
  getDefaultConfigPath: vi.fn(),
}));

const mockedRunCommand = vi.mocked(runCommand);
const mockedParseDatabricksConfig = vi.mocked(parseDatabricksConfig);
const mockedGetDefaultConfigPath = vi.mocked(getDefaultConfigPath);

describe('executeSql', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assembles statements API command and parses successful response', async () => {
    mockedRunCommand.mockResolvedValue({
      stdout: JSON.stringify({
        manifest: {
          schema: {
            columns: [{ name: 'catalog', type_name: 'STRING', position: 0 }],
          },
          total_row_count: 2,
        },
        result: {
          data_array: [['unity'], ['system']],
        },
        status: { state: 'SUCCEEDED' },
      }),
      stderr: '',
      exitCode: 0,
    });

    const result = await executeSql('SHOW CATALOGS', 'wh-123', 'alpha');

    expect(result).toEqual({
      columns: [{ name: 'catalog', type: 'STRING' }],
      rows: [['unity'], ['system']],
      rowCount: 2,
      truncated: false,
    });

    expect(mockedRunCommand).toHaveBeenCalledTimes(1);
    const [args, options] = mockedRunCommand.mock.calls[0];
    expect(args.slice(0, 4)).toEqual(['api', 'post', '/api/2.0/sql/statements', '--json']);
    expect(options).toEqual({ profile: 'alpha', timeoutMs: 60000 });

    const payload = JSON.parse(args[4]);
    expect(payload).toEqual({
      statement: 'SHOW CATALOGS',
      warehouse_id: 'wh-123',
      wait_timeout: '30s',
    });
  });

  it('handles empty result payload for zero-row response', async () => {
    mockedRunCommand.mockResolvedValue({
      stdout: JSON.stringify({
        manifest: {
          schema: {
            columns: [{ name: 'catalog', type_name: 'STRING', position: 0 }],
          },
          total_row_count: 0,
        },
        result: {},
        status: { state: 'SUCCEEDED' },
      }),
      stderr: '',
      exitCode: 0,
    });

    const result = await executeSql('SHOW CATALOGS', 'wh-123', 'alpha');

    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it('throws API error message when statement fails', async () => {
    mockedRunCommand.mockResolvedValue({
      stdout: JSON.stringify({
        status: {
          state: 'FAILED',
          error: {
            message: '[TABLE_OR_VIEW_NOT_FOUND] Table not found',
          },
        },
      }),
      stderr: '',
      exitCode: 0,
    });

    await expect(executeSql('SELECT * FROM missing_table', 'wh-123', 'alpha')).rejects.toThrow(
      '[TABLE_OR_VIEW_NOT_FOUND] Table not found'
    );
  });

  it('throws when databricks command exits non-zero', async () => {
    mockedRunCommand.mockResolvedValue({
      stdout: '',
      stderr: 'boom',
      exitCode: 1,
    });

    await expect(executeSql('SHOW CATALOGS', 'wh-123', 'alpha')).rejects.toThrow('boom');
  });
});

describe('resolveWarehouse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDefaultConfigPath.mockReturnValue('/tmp/.databrickscfg');
  });

  it('uses warehouse_id from selected profile', async () => {
    mockedParseDatabricksConfig.mockResolvedValue({
      profiles: {
        alpha: {
          host: 'https://workspace.cloud.databricks.com',
          warehouse_id: 'warehouse-from-profile',
        },
      },
    });

    const result = await resolveWarehouse('alpha');

    expect(result).toEqual({
      profile: 'alpha',
      warehouseId: 'warehouse-from-profile',
    });
    expect(mockedRunCommand).not.toHaveBeenCalled();
  });

  it('falls back to first running warehouse from CLI list', async () => {
    mockedParseDatabricksConfig.mockResolvedValue({
      profiles: {
        alpha: {
          host: 'https://workspace.cloud.databricks.com',
        },
      },
    });

    mockedRunCommand.mockResolvedValue({
      stdout: JSON.stringify([
        { id: 'warehouse-stopped', state: 'STOPPED' },
        { id: 'warehouse-running', state: 'RUNNING' },
      ]),
      stderr: '',
      exitCode: 0,
    });

    const result = await resolveWarehouse('alpha');

    expect(result).toEqual({
      profile: 'alpha',
      warehouseId: 'warehouse-running',
    });
    expect(mockedRunCommand).toHaveBeenCalledWith(
      ['warehouses', 'list', '--output', 'json'],
      { profile: 'alpha' }
    );
  });

  it('throws with available profiles when profile does not exist', async () => {
    mockedParseDatabricksConfig.mockResolvedValue({
      profiles: {
        alpha: { host: 'https://a.cloud.databricks.com' },
        beta: { host: 'https://b.cloud.databricks.com' },
      },
    });

    await expect(resolveWarehouse('missing')).rejects.toThrow('Available profiles: alpha, beta');
  });

  it('throws setup guidance when no running warehouse is available', async () => {
    mockedParseDatabricksConfig.mockResolvedValue({
      profiles: {
        alpha: { host: 'https://a.cloud.databricks.com' },
      },
    });

    mockedRunCommand.mockResolvedValue({
      stdout: JSON.stringify([{ id: 'warehouse-stopped', state: 'STOPPED' }]),
      stderr: '',
      exitCode: 0,
    });

    await expect(resolveWarehouse('alpha')).rejects.toThrow('No running SQL warehouse found');
  });
});

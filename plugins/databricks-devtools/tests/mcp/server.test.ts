import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSql, resolveWarehouse } from '../../src/sql/executor.js';
import {
  describeTableTool,
  listCatalogsTool,
  listSchemasTool,
  listTablesTool,
  previewDataTool,
  tableMetadataTool,
} from '../../src/mcp/server.js';

vi.mock('../../src/sql/executor.js', () => ({
  executeSql: vi.fn(),
  resolveWarehouse: vi.fn(),
}));

const mockedExecuteSql = vi.mocked(executeSql);
const mockedResolveWarehouse = vi.mocked(resolveWarehouse);

describe('MCP SQL explorer tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolveWarehouse.mockResolvedValue({
      profile: 'alpha',
      warehouseId: 'wh-123',
    });
    mockedExecuteSql.mockResolvedValue({
      columns: [{ name: 'catalog', type: 'STRING' }],
      rows: [['unity']],
      rowCount: 1,
      truncated: false,
    });
  });

  it('listCatalogsTool executes SHOW CATALOGS', async () => {
    const result = await listCatalogsTool('alpha');

    expect(mockedResolveWarehouse).toHaveBeenCalledWith('alpha');
    expect(mockedExecuteSql).toHaveBeenCalledWith('SHOW CATALOGS', 'wh-123', 'alpha');

    expect(JSON.parse(result)).toMatchObject({
      profile: 'alpha',
      warehouse_id: 'wh-123',
      sql: 'SHOW CATALOGS',
      row_count: 1,
    });
  });

  it('listSchemasTool quotes catalog identifier', async () => {
    await listSchemasTool('unity', 'alpha');

    expect(mockedExecuteSql).toHaveBeenCalledWith(
      'SHOW SCHEMAS IN `unity`',
      'wh-123',
      'alpha'
    );
  });

  it('listTablesTool quotes catalog and schema identifiers', async () => {
    await listTablesTool('unity', 'croquis_data_search', 'alpha');

    expect(mockedExecuteSql).toHaveBeenCalledWith(
      'SHOW TABLES IN `unity`.`croquis_data_search`',
      'wh-123',
      'alpha'
    );
  });

  it('describeTableTool requires fully qualified table name', async () => {
    await expect(describeTableTool('events', 'alpha')).rejects.toThrow('fully qualified');
  });

  it('tableMetadataTool executes DESCRIBE DETAIL for fully qualified table', async () => {
    await tableMetadataTool('unity.analytics.events', 'alpha');

    expect(mockedExecuteSql).toHaveBeenCalledWith(
      'DESCRIBE DETAIL `unity`.`analytics`.`events`',
      'wh-123',
      'alpha'
    );
  });

  it('previewDataTool defaults to LIMIT 10', async () => {
    await previewDataTool('unity.analytics.events', undefined, 'alpha');

    expect(mockedExecuteSql).toHaveBeenCalledWith(
      'SELECT * FROM `unity`.`analytics`.`events` LIMIT 10',
      'wh-123',
      'alpha'
    );
  });

  it('previewDataTool validates limit range', async () => {
    await expect(previewDataTool('unity.analytics.events', 0, 'alpha')).rejects.toThrow('limit');
  });
});

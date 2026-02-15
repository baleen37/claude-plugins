import { parseJsonOutput } from '../cli/parser.js';
import { runCommand } from '../cli/runner.js';
import { parseDatabricksConfig } from '../config/databrickscfg.js';
import { getDefaultConfigPath } from '../config/profiles.js';

const DEFAULT_PROFILE = 'default';
const API_WAIT_TIMEOUT = '30s';
const CLI_TIMEOUT_MS = 60_000;

interface StatementColumn {
  name: string;
  type_name: string;
  position?: number;
}

interface StatementSuccessResponse {
  manifest?: {
    schema?: {
      columns?: StatementColumn[];
    };
    total_row_count?: number;
    truncated?: boolean;
  };
  result?: {
    data_array?: Array<Array<string | null>>;
  };
  status?: {
    state?: string;
    error?: {
      message?: string;
    };
  };
}

interface WarehouseListItem {
  id?: string;
  state?: string;
}

export interface SqlResult {
  columns: Array<{ name: string; type: string }>;
  rows: Array<Array<string | null>>;
  rowCount: number;
  truncated: boolean;
}

export interface WarehouseResolution {
  profile: string;
  warehouseId: string;
}

function resolveProfile(profile?: string): string {
  return profile && profile.trim() ? profile : DEFAULT_PROFILE;
}

function parseSqlError(response: StatementSuccessResponse): string | null {
  if (response.status?.state === 'FAILED') {
    return response.status.error?.message ?? 'SQL statement failed';
  }
  return null;
}

export async function executeSql(
  sql: string,
  warehouseId: string,
  profile?: string
): Promise<SqlResult> {
  const resolvedProfile = resolveProfile(profile);

  const payload = JSON.stringify({
    statement: sql,
    warehouse_id: warehouseId,
    wait_timeout: API_WAIT_TIMEOUT,
  });

  const command = ['api', 'post', '/api/2.0/sql/statements', '--json', payload];
  const result = await runCommand(command, { profile: resolvedProfile, timeoutMs: CLI_TIMEOUT_MS });

  if (result.exitCode !== 0) {
    const errorMessage = result.stderr.trim() || result.stdout.trim() || 'Databricks SQL API command failed';
    throw new Error(errorMessage);
  }

  const response = parseJsonOutput<StatementSuccessResponse>(result.stdout);
  const statementError = parseSqlError(response);
  if (statementError) {
    throw new Error(statementError);
  }

  const columns = (response.manifest?.schema?.columns ?? []).map((column) => ({
    name: column.name,
    type: column.type_name,
  }));

  const rows = response.result?.data_array ?? [];
  const rowCount = response.manifest?.total_row_count ?? rows.length;
  const truncated = response.manifest?.truncated ?? false;

  return {
    columns,
    rows,
    rowCount,
    truncated,
  };
}

function listAvailableProfiles(profiles: Record<string, unknown>): string {
  const names = Object.keys(profiles);
  return names.length > 0 ? names.join(', ') : '(none)';
}

async function loadProfile(profile: string): Promise<Record<string, string | undefined>> {
  const configPath = getDefaultConfigPath();
  const config = await parseDatabricksConfig(configPath);
  const selected = config.profiles[profile];

  if (!selected) {
    const available = listAvailableProfiles(config.profiles);
    throw new Error(
      `Databricks profile "${profile}" not found in ${configPath}. Available profiles: ${available}`
    );
  }

  return selected;
}

function firstRunningWarehouse(warehouses: WarehouseListItem[]): string | null {
  for (const warehouse of warehouses) {
    if (warehouse.state === 'RUNNING' && warehouse.id) {
      return warehouse.id;
    }
  }

  return null;
}

async function discoverWarehouseFromCli(profile: string): Promise<string> {
  const warehouseListResult = await runCommand(
    ['warehouses', 'list', '--output', 'json'],
    { profile }
  );

  if (warehouseListResult.exitCode !== 0) {
    const errorMessage =
      warehouseListResult.stderr.trim() ||
      warehouseListResult.stdout.trim() ||
      'Failed to list SQL warehouses';
    throw new Error(errorMessage);
  }

  const warehouses = parseJsonOutput<WarehouseListItem[]>(warehouseListResult.stdout);
  const warehouseId = firstRunningWarehouse(warehouses);

  if (!warehouseId) {
    throw new Error(
      'No running SQL warehouse found. Set warehouse_id in your Databricks profile or start a SQL warehouse.'
    );
  }

  return warehouseId;
}

export async function resolveWarehouse(profile?: string): Promise<WarehouseResolution> {
  const resolvedProfile = resolveProfile(profile);
  const profileConfig = await loadProfile(resolvedProfile);

  if (profileConfig.warehouse_id && profileConfig.warehouse_id.trim()) {
    return {
      profile: resolvedProfile,
      warehouseId: profileConfig.warehouse_id,
    };
  }

  const warehouseId = await discoverWarehouseFromCli(resolvedProfile);
  return {
    profile: resolvedProfile,
    warehouseId,
  };
}

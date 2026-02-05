import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_DATABRICKS_PATH = '/opt/homebrew/bin/databricks';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunOptions {
  profile?: string;
  input?: string;
  env?: Record<string, string>;
  databricksPath?: string;
}

export class DatabricksNotFoundError extends Error {
  constructor(searchedPaths: string[]) {
    super(
      `Databricks CLI not found. Searched paths: ${searchedPaths.join(', ')}. ` +
        'Install it from https://docs.databricks.com/en/dev-tools/cli/install.html'
    );
    this.name = 'DatabricksNotFoundError';
  }
}

async function findDatabricksExecutable(customPath?: string): Promise<string> {
  if (customPath) {
    if (existsSync(customPath)) {
      return customPath;
    }
    throw new DatabricksNotFoundError([customPath]);
  }

  if (existsSync(DEFAULT_DATABRICKS_PATH)) {
    return DEFAULT_DATABRICKS_PATH;
  }

  const pathEnv = process.env.PATH ?? '';
  const pathDirs = pathEnv.split(':');

  for (const dir of pathDirs) {
    const candidate = resolve(dir, 'databricks');
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new DatabricksNotFoundError([DEFAULT_DATABRICKS_PATH, ...pathDirs.map(d => resolve(d, 'databricks'))]);
}

function buildArgs(args: string[], options?: RunOptions): string[] {
  const commandArgs: string[] = [];

  if (options?.profile) {
    commandArgs.push('--profile', options.profile);
  }

  commandArgs.push(...args);

  return commandArgs;
}

export async function runCommand(
  args: string[],
  options?: RunOptions
): Promise<CommandResult> {
  const databricksPath = await findDatabricksExecutable(options?.databricksPath);
  const commandArgs = buildArgs(args, options);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const spawnOptions = {
      env: { ...process.env, ...options?.env },
    };

    const child = spawn(databricksPath, commandArgs, spawnOptions);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    if (options?.input) {
      child.stdin?.write(options.input);
      child.stdin?.end();
    }

    child.on('close', (code: number | null) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    child.on('error', (error: Error) => {
      reject(new Error(`Failed to spawn databricks process: ${error.message}`));
    });
  });
}

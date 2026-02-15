import { homedir } from 'node:os';
import { join } from 'node:path';

export function getDefaultConfigPath(): string {
  return join(homedir(), '.databrickscfg');
}

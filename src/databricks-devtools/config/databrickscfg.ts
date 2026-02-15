import { readFile } from 'node:fs/promises';
import type { ConfigData, ProfileConfig } from './types.js';

export async function parseDatabricksConfig(path: string): Promise<ConfigData> {
  const content = await readFile(path, 'utf-8');
  return parseDatabricksConfigContent(content);
}

export function parseDatabricksConfigContent(content: string): ConfigData {
  const profiles: Record<string, ProfileConfig> = {};
  const lines = content.split('\n');

  let currentProfile: string | null = null;
  let currentConfig: ProfileConfig = {};

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) continue;

    if (trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) continue;

    const sectionMatch = trimmedLine.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      if (currentProfile) {
        profiles[currentProfile] = currentConfig;
      }

      const profileName = sectionMatch[1];
      if (profileName !== 'DEFAULT') {
        currentProfile = profileName;
        currentConfig = {};
      } else {
        currentProfile = null;
        currentConfig = {};
      }
      continue;
    }

    const keyValueMatch = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();

      if (currentProfile) {
        currentConfig[key] = value;
      }
      continue;
    }

    const spaceMatch = trimmedLine.match(/^(\S+)\s+(.+)$/);
    if (spaceMatch) {
      const key = spaceMatch[1];
      const value = spaceMatch[2].trim();

      if (currentProfile) {
        currentConfig[key] = value;
      }
    }
  }

  if (currentProfile) {
    profiles[currentProfile] = currentConfig;
  }

  return { profiles };
}

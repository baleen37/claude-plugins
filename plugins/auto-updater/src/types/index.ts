// Hook input types
export interface SessionStartInput {
  session_id: string;
  transcript_path: string;
  [key: string]: unknown;
}

// Config types
export interface Config {
  marketplaces: MarketplaceConfig[];
}

export interface MarketplaceConfig {
  name: string;
  plugins?: string[];
}

// Marketplace types
export interface Marketplace {
  name?: string;
  description?: string;
  author?: {
    name: string;
    email?: string;
  };
  plugins: Plugin[];
}

export interface Plugin {
  name: string;
  version: string;
  description?: string;
}

// Installed plugin types
export interface InstalledPlugin {
  id?: string;
  name: string;
  version: string;
  scope?: string;
  enabled?: boolean;
  installPath?: string;
  installedAt?: string;
  lastUpdated?: string;
}

// Semver types
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
}

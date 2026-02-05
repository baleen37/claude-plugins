export interface ProfileConfig {
  [key: string]: string | undefined;
  host?: string;
  token?: string;
  cluster_id?: string;
  warehouse_id?: string;
  auth_type?: string;
  account_id?: string;
  workspace_id?: string;
}

export interface ConfigData {
  profiles: Record<string, ProfileConfig>;
}

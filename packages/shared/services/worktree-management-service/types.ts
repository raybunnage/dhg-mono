// Worktree Management Types

export interface WorktreeDefinition {
  id: string;
  path: string;
  alias_name: string;
  alias_number: string;
  emoji: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorktreeAppMapping {
  id: string;
  worktree_id: string;
  app_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorktreePipelineMapping {
  id: string;
  worktree_id: string;
  pipeline_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorktreeServiceMapping {
  id: string;
  worktree_id: string;
  service_id: string;
  service_name?: string; // Populated from join
  created_at?: string;
  updated_at?: string;
}

export interface CreateWorktreeInput {
  path: string;
  alias_name: string;
  alias_number: string;
  emoji: string;
  description?: string;
}

export interface UpdateWorktreeInput {
  path?: string;
  alias_name?: string;
  alias_number?: string;
  emoji?: string;
  description?: string;
}

export interface WorktreeMappingSummary {
  worktree: WorktreeDefinition;
  apps: string[];
  pipelines: string[];
  services: string[];
}

export interface WorktreeFilters {
  hasApps?: boolean;
  hasPipelines?: boolean;
  hasServices?: boolean;
  app?: string;
  pipeline?: string;
  service?: string;
}

export interface MappingChange {
  worktreeId: string;
  type: 'app' | 'pipeline' | 'service';
  name: string;
  action: 'add' | 'remove';
}

export interface BatchMappingUpdate {
  apps?: {
    add: string[];
    remove: string[];
  };
  pipelines?: {
    add: string[];
    remove: string[];
  };
  services?: {
    add: string[];
    remove: string[];
  };
}

// Standard app list (can be dynamically loaded if stored in database)
export const STANDARD_APPS = [
  'dhg-hub',
  'dhg-hub-lovable',
  'dhg-audio',
  'dhg-admin-suite',
  'dhg-admin-code',
  'dhg-admin-google',
  'dhg-a',
  'dhg-b',
  'dhg-improve-experts',
  'dhg-research'
] as const;

export type StandardApp = typeof STANDARD_APPS[number];
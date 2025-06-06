// Comprehensive worktree mapping to apps and CLI pipelines
export interface WorktreeMapping {
  path: string;
  alias: { number: string; name: string; emoji: string };
  apps: string[];
  cliPipelines: string[];
  description: string;
}

export const worktreeMappings: WorktreeMapping[] = [
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono',
    alias: { number: 'c1', name: 'cdev', emoji: '🟢' },
    apps: ['dhg-hub', 'dhg-hub-lovable', 'dhg-audio', 'dhg-admin-suite', 'dhg-admin-code', 'dhg-admin-google'],
    cliPipelines: ['all_pipelines', 'monitoring', 'work_summaries', 'dev_tasks'],
    description: 'Main development branch - all apps and core pipelines'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-admin-code',
    alias: { number: 'c2', name: 'cadmin', emoji: '🔵' },
    apps: ['dhg-admin-code'],
    cliPipelines: ['dev_tasks', 'database', 'auth', 'monitoring', 'refactor_tracking', 'work_summaries'],
    description: 'Admin code features - task management, database UI'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-dhg-hub',
    alias: { number: 'c3', name: 'chub', emoji: '🟣' },
    apps: ['dhg-hub', 'dhg-hub-lovable'],
    cliPipelines: ['auth', 'shared'],
    description: 'Hub application development'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs',
    alias: { number: 'c4', name: 'cdocs', emoji: '🟠' },
    apps: [],
    cliPipelines: ['document', 'document_types', 'classify', 'viewers'],
    description: 'Documentation and continuous docs features'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app',
    alias: { number: 'c5', name: 'cgmail', emoji: '🔴' },
    apps: [],
    cliPipelines: ['google_sync', 'drive_filter', 'tracking'],
    description: 'Gmail integration and research'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-improve-audio',
    alias: { number: 'c6', name: 'caudio', emoji: '🟡' },
    apps: ['dhg-audio'],
    cliPipelines: ['media-processing', 'presentations'],
    description: 'Audio app improvements and media processing'
  },
  // Also handle alternate path name
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-dhg-mono-audio',
    alias: { number: 'c6', name: 'caudio', emoji: '🟡' },
    apps: ['dhg-audio'],
    cliPipelines: ['media-processing', 'presentations'],
    description: 'Audio app improvements and media processing'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines',
    alias: { number: 'c7', name: 'ccli', emoji: '🔷' },
    apps: [],
    cliPipelines: ['all_pipelines', 'ai', 'analysis', 'classify', 'core', 'database', 'dev_tasks', 'document', 'document_types', 'drive_filter', 'experts', 'google_sync', 'media-processing', 'presentations', 'prompt_service', 'scripts', 'shared', 'tracking', 'utilities', 'viewers', 'work_summaries'],
    description: 'CLI pipeline improvements - all pipelines'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-improve-google',
    alias: { number: 'c8', name: 'cgoogle', emoji: '🩷' },
    apps: ['dhg-admin-google'],
    cliPipelines: ['google_sync', 'drive_filter', 'classify', 'document', 'experts'],
    description: 'Google integration and admin features'
  },
  // Also handle alternate path name
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-dhg-mono-admin-google',
    alias: { number: 'c8', name: 'cgoogle', emoji: '🩷' },
    apps: ['dhg-admin-google'],
    cliPipelines: ['google_sync', 'drive_filter', 'classify', 'document', 'experts'],
    description: 'Google integration and admin features'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-improve-suite',
    alias: { number: 'c9', name: 'csuite', emoji: '🟩' },
    apps: ['dhg-admin-suite'],
    cliPipelines: ['auth', 'database', 'shared'],
    description: 'Admin suite improvements'
  },
  {
    path: '/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks',
    alias: { number: 'c0', name: 'cfix', emoji: '🟪' },
    apps: ['dhg-hub', 'dhg-hub-lovable', 'dhg-audio', 'dhg-admin-suite', 'dhg-admin-code', 'dhg-admin-google'],
    cliPipelines: ['all_pipelines', 'utilities'],
    description: 'Bug fixes and integration tweaks - all apps'
  }
];

// Helper functions
export function getWorktreeByPath(path: string): WorktreeMapping | undefined {
  return worktreeMappings.find(w => w.path === path);
}

export function getWorktreeByAlias(alias: string): WorktreeMapping | undefined {
  return worktreeMappings.find(w => 
    w.alias.number === alias || w.alias.name === alias
  );
}

export function getAppsForWorktree(worktreePath: string): string[] {
  const mapping = getWorktreeByPath(worktreePath);
  return mapping?.apps || [];
}

export function getCliPipelinesForWorktree(worktreePath: string): string[] {
  const mapping = getWorktreeByPath(worktreePath);
  return mapping?.cliPipelines || [];
}

export function getWorktreeLabel(worktree: WorktreeMapping): string {
  return `${worktree.alias.emoji} ${worktree.alias.number}/${worktree.alias.name} - ${worktree.path.split('/').pop()}`;
}

// Get all unique apps across all worktrees
export function getAllApps(): string[] {
  const allApps = new Set<string>();
  worktreeMappings.forEach(w => w.apps.forEach(app => allApps.add(app)));
  return Array.from(allApps).sort();
}

// Get all unique CLI pipelines across all worktrees
export function getAllCliPipelines(): string[] {
  const allPipelines = new Set<string>();
  worktreeMappings.forEach(w => w.cliPipelines.forEach(pipeline => allPipelines.add(pipeline)));
  return Array.from(allPipelines).sort();
}
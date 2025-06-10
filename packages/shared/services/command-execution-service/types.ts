// Command Execution Types

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // in milliseconds
  command: string;
  timestamp: string;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number; // in milliseconds
  shell?: boolean;
  encoding?: BufferEncoding;
}

export interface GitCommandResult extends CommandResult {
  parsed?: any; // Parsed output based on command type
}

export interface CommandHistory {
  id: string;
  command: string;
  context: string; // Where it was executed (worktree, app, etc.)
  result: CommandResult;
  created_at: string;
  user_id?: string;
}

export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  parameters: CommandParameter[];
  category: string;
  tags: string[];
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'select';
  description: string;
  required: boolean;
  default?: any;
  options?: string[]; // For select type
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  commit: string;
  author: string;
  date: string;
  message: string;
  ahead?: number;
  behind?: number;
  upstream?: string;
}

export interface GitWorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  bare: boolean;
  detached: boolean;
  locked?: string; // Lock reason if locked
  prunable?: string; // Reason if prunable
}

export interface GitStatusInfo {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  clean: boolean;
}

export interface GitCommitInfo {
  hash: string;
  abbreviatedHash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  refs: string[];
  files?: string[];
}

// Common Git command templates
export const GIT_COMMAND_TEMPLATES: Record<string, CommandTemplate> = {
  status: {
    id: 'git-status',
    name: 'Git Status',
    description: 'Show working tree status',
    template: 'git status --porcelain=v1',
    parameters: [],
    category: 'git',
    tags: ['status', 'basic']
  },
  branches: {
    id: 'git-branches',
    name: 'List Branches',
    description: 'List all branches',
    template: 'git branch -a --format="%(refname:short)|%(HEAD)|%(upstream:short)|%(committerdate:iso)|%(authorname)|%(subject)"',
    parameters: [],
    category: 'git',
    tags: ['branches', 'list']
  },
  worktrees: {
    id: 'git-worktrees',
    name: 'List Worktrees',
    description: 'List all worktrees',
    template: 'git worktree list --porcelain',
    parameters: [],
    category: 'git',
    tags: ['worktrees', 'list']
  },
  log: {
    id: 'git-log',
    name: 'Git Log',
    description: 'Show commit logs',
    template: 'git log --oneline -{count}',
    parameters: [{
      name: 'count',
      type: 'number',
      description: 'Number of commits to show',
      required: false,
      default: 10
    }],
    category: 'git',
    tags: ['log', 'history']
  },
  checkout: {
    id: 'git-checkout',
    name: 'Checkout Branch',
    description: 'Switch to a branch',
    template: 'git checkout {branch}',
    parameters: [{
      name: 'branch',
      type: 'string',
      description: 'Branch name',
      required: true
    }],
    category: 'git',
    tags: ['checkout', 'switch']
  },
  pull: {
    id: 'git-pull',
    name: 'Pull Changes',
    description: 'Pull changes from remote',
    template: 'git pull origin {branch}',
    parameters: [{
      name: 'branch',
      type: 'string',
      description: 'Branch name',
      required: true
    }],
    category: 'git',
    tags: ['pull', 'sync']
  },
  push: {
    id: 'git-push',
    name: 'Push Changes',
    description: 'Push changes to remote',
    template: 'git push origin {branch}',
    parameters: [{
      name: 'branch',
      type: 'string',
      description: 'Branch name',
      required: true
    }],
    category: 'git',
    tags: ['push', 'sync']
  }
};
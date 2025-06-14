/**
 * GitOperationsService Types
 * 
 * Core types for git operations, worktrees, branches, and commits
 */

import { Logger } from '../logger-service';

// Core Data Types
export interface GitWorktree {
  path: string;
  branch: string;
  commit: string;
  bare?: boolean;
  detached?: boolean;
  locked?: boolean;
  prunable?: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  commit: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  clean: boolean;
}

// Operation Result Types
export interface GitOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  command?: string;
}

export interface WorktreeCreateOptions {
  branch?: string;
  checkout?: string;
  detach?: boolean;
  force?: boolean;
  lock?: boolean;
}

export interface CommitOptions {
  message: string;
  author?: string;
  email?: string;
  amend?: boolean;
  signoff?: boolean;
  files?: string[];
}

export interface MergeOptions {
  strategy?: 'ours' | 'theirs' | 'recursive';
  squash?: boolean;
  noCommit?: boolean;
  fastForward?: boolean;
}

// Service Configuration
export interface GitOperationsServiceConfig {
  workingDirectory?: string;
  cacheTimeout?: number;
  maxCacheSize?: number;
  enableMetrics?: boolean;
  gitPath?: string;
}

// Metrics and Health Types
export interface GitOperationsServiceMetrics {
  worktreeOperations: number;
  branchOperations: number;
  commitQueries: number;
  mergeOperations: number;
  statusChecks: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  lastOperationTime?: Date;
  operationsPerMinute: number;
}

export interface GitOperationsServiceHealth {
  isHealthy: boolean;
  gitAvailable: boolean;
  workingDirectoryValid: boolean;
  repositoryValid: boolean;
  lastError?: string;
  lastErrorTime?: Date;
  uptime: number;
  cacheSize: number;
  operationsCount: number;
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

export interface GitOperationsCache {
  worktrees: Map<string, CacheEntry<GitWorktree[]>>;
  branches: Map<string, CacheEntry<GitBranch[]>>;
  commits: Map<string, CacheEntry<GitCommit[]>>;
  status: Map<string, CacheEntry<GitStatus>>;
}

// Event Types
export interface GitOperationEvent {
  type: 'worktree' | 'branch' | 'commit' | 'merge' | 'status';
  operation: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
  timestamp: Date;
}

// Logger Interface Extension
export interface GitOperationsLogger extends Logger {
  gitOperation(event: GitOperationEvent): void;
  gitError(operation: string, error: string, command?: string): void;
  gitSuccess(operation: string, data?: any, duration?: number): void;
}

// Service State
export interface GitOperationsServiceState {
  initialized: boolean;
  workingDirectory: string;
  gitPath: string;
  cacheEnabled: boolean;
  metricsEnabled: boolean;
  lastHealthCheck?: Date;
  startTime: Date;
}

// Error Types
export class GitOperationError extends Error {
  constructor(
    message: string,
    public command?: string,
    public exitCode?: number,
    public stderr?: string
  ) {
    super(message);
    this.name = 'GitOperationError';
  }
}

export class GitWorktreeError extends GitOperationError {
  constructor(message: string, command?: string, exitCode?: number, stderr?: string) {
    super(message, command, exitCode, stderr);
    this.name = 'GitWorktreeError';
  }
}

export class GitBranchError extends GitOperationError {
  constructor(message: string, command?: string, exitCode?: number, stderr?: string) {
    super(message, command, exitCode, stderr);
    this.name = 'GitBranchError';
  }
}

// Type Guards
export function isGitWorktree(obj: any): obj is GitWorktree {
  return obj && typeof obj.path === 'string' && typeof obj.branch === 'string' && typeof obj.commit === 'string';
}

export function isGitBranch(obj: any): obj is GitBranch {
  return obj && typeof obj.name === 'string' && typeof obj.current === 'boolean' && typeof obj.commit === 'string';
}

export function isGitCommit(obj: any): obj is GitCommit {
  return obj && typeof obj.hash === 'string' && typeof obj.author === 'string' && obj.date instanceof Date;
}

export function isGitOperationResult<T>(obj: any): obj is GitOperationResult<T> {
  return obj && typeof obj.success === 'boolean';
}
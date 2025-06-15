/**
 * Worktree Switcher Service - Refactored
 * 
 * Service for managing git worktrees and generating switcher UI
 * Refactored to extend SingletonService with proper patterns
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { SingletonService } from '../base-classes/SingletonService';

export interface Worktree {
  path: string;
  head: string;
  branch?: string;
  detached?: boolean;
  name: string;
  isActive: boolean;
  hasCursor: boolean;
  cursorPid: string | null;
  hasPeacock: boolean;
  peacockColor: string | null;
}

interface WorktreeSwitcherConfig {
  gitCommand?: string;
}

interface WorktreeSwitcherMetrics {
  totalQueries: number;
  worktreesFound: number;
  errors: number;
  lastQueryTime?: Date;
}

export class WorktreeSwitcherService extends SingletonService {
  private static instance: WorktreeSwitcherService;
  private gitCommand: string;
  private metrics: WorktreeSwitcherMetrics = {
    totalQueries: 0,
    worktreesFound: 0,
    errors: 0
  };

  protected constructor(config: WorktreeSwitcherConfig = {}) {
    super('WorktreeSwitcherService');
    this.gitCommand = config.gitCommand || 'git';
  }

  public static getInstance(config?: WorktreeSwitcherConfig): WorktreeSwitcherService {
    if (!WorktreeSwitcherService.instance) {
      WorktreeSwitcherService.instance = new WorktreeSwitcherService(config);
    }
    return WorktreeSwitcherService.instance;
  }

  protected async initialize(): Promise<void> {
    this.logger?.info('WorktreeSwitcherService initializing...');
    
    try {
      execSync(`${this.gitCommand} --version`, { encoding: 'utf8' });
      this.logger?.info('WorktreeSwitcherService initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize WorktreeSwitcherService:', error);
      throw new Error('Git is not available');
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('WorktreeSwitcherService cleanup completed');
  }

  protected async releaseResources(): Promise<void> {
    // No resources to release
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    let healthy = true;
    const details: any = {
      metrics: { ...this.metrics },
      gitCommand: this.gitCommand,
      gitAvailable: 'unknown'
    };

    try {
      const version = execSync(`${this.gitCommand} --version`, { encoding: 'utf8' }).trim();
      details.gitAvailable = version;
    } catch (error) {
      healthy = false;
      details.gitAvailable = 'error';
      details.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return { healthy, details, timestamp: new Date() };
  }

  getWorktrees(): Worktree[] {
    this.metrics.totalQueries++;
    this.metrics.lastQueryTime = new Date();

    try {
      const output = execSync(`${this.gitCommand} worktree list --porcelain`, { encoding: 'utf8' });
      const worktrees: any[] = [];
      let current: any = {};
      
      output.split('\n').forEach(line => {
        if (line.startsWith('worktree ')) {
          if (current.path) worktrees.push(current);
          current = { path: line.substring(9) };
        } else if (line.startsWith('HEAD ')) {
          current.head = line.substring(5);
        } else if (line.startsWith('branch ')) {
          current.branch = line.substring(7);
        } else if (line === 'detached') {
          current.detached = true;
        }
      });

      if (current.path) worktrees.push(current);

      const enhancedWorktrees = worktrees.map(wt => ({
        ...wt,
        name: path.basename(wt.path),
        isActive: false, // Would need to check current directory
        hasCursor: false,
        cursorPid: null,
        hasPeacock: false,
        peacockColor: null
      }));

      this.metrics.worktreesFound = enhancedWorktrees.length;
      return enhancedWorktrees;
    } catch (error) {
      this.metrics.errors++;
      this.logger?.error('Error getting worktrees:', error);
      return [];
    }
  }

  getMetrics(): WorktreeSwitcherMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      worktreesFound: 0,
      errors: 0
    };
  }
}

export default WorktreeSwitcherService;
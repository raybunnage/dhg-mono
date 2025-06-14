/**
 * Git Operations Service (Refactored)
 * 
 * Service for Git operations including worktrees, branches, and commits.
 * Refactored from standalone class to SingletonService with proper lifecycle management.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { SingletonService } from '../base-classes/SingletonService';
import { Logger } from '../base-classes/BaseService';
import {
  Worktree,
  Branch,
  Commit,
  BranchCleanupResult,
  GitOperationsServiceMetrics,
  GitOperationsServiceConfig,
  GitCommandResult,
  WorktreeCommitsResult
} from './types';

const execAsync = promisify(exec);

export class GitOperationsService extends SingletonService {
  private protectedBranches = ['main', 'master', 'development', 'production'];
  
  private metrics: GitOperationsServiceMetrics = {
    worktreeOperations: 0,
    branchOperations: 0,
    commitQueries: 0,
    branchesDeleted: 0,
    branchCleanupOperations: 0,
    commandExecutions: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageOperationTime: 0,
    totalOperationTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0
  };

  private worktreeCache: Map<string, { data: Worktree[]; timestamp: number }> = new Map();
  private branchCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTimeout = 30000; // 30 seconds
  private lastOperationTime: Date = new Date();

  constructor(
    config: GitOperationsServiceConfig = {},
    logger?: Logger
  ) {
    super('GitOperationsService', logger);
    
    if (config.protectedBranches) {
      this.protectedBranches = [...this.protectedBranches, ...config.protectedBranches];
    }
    
    if (config.cacheTimeout) {
      this.cacheTimeout = config.cacheTimeout;
    }
  }

  protected validateConfig(): void {
    // No specific config validation needed for this service
  }

  protected async initialize(): Promise<void> {
    // Validate git is available
    try {
      await execAsync('git --version');
      this.logger?.info('GitOperationsService initialized - Git is available');
    } catch (error) {
      throw new Error('Git is not available in the system PATH');
    }
  }

  async healthCheck(): Promise<{ 
    healthy: boolean; 
    details: Record<string, any>; 
    timestamp: Date; 
    latencyMs?: number 
  }> {
    const startTime = Date.now();
    const checks = {
      gitAvailable: false,
      repositoryValid: false,
      lastOperationTime: this.lastOperationTime.toISOString(),
      cacheSize: this.worktreeCache.size + this.branchCache.size
    };

    try {
      // Check if git is available
      await execAsync('git --version');
      checks.gitAvailable = true;

      // Check if we're in a git repository
      await execAsync('git rev-parse --git-dir');
      checks.repositoryValid = true;

    } catch (error) {
      this.logger?.error('Git health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    const healthy = checks.gitAvailable && checks.repositoryValid;
    const latencyMs = Date.now() - startTime;

    return {
      healthy,
      details: { ...checks, metrics: this.metrics },
      timestamp: new Date(),
      latencyMs
    };
  }

  protected async cleanup(): Promise<void> {
    this.clearCaches();
    this.logger?.info('GitOperationsService cleaned up');
  }

  getMetrics(): GitOperationsServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all git worktrees with enhanced information
   */
  async getWorktrees(useCache: boolean = true): Promise<Worktree[]> {
    await this.ensureInitialized();
    this.lastOperationTime = new Date();
    this.metrics.worktreeOperations++;
    
    const startTime = Date.now();
    const cacheKey = 'worktrees';

    try {
      // Check cache first
      if (useCache && this.isCacheValid(this.worktreeCache, cacheKey)) {
        this.metrics.cacheHits++;
        return this.worktreeCache.get(cacheKey)!.data;
      }
      this.metrics.cacheMisses++;

      const { stdout, stderr } = await execAsync('git worktree list');
      
      if (stderr) {
        this.logger?.warn('Git worktree warning', { stderr });
      }

      // Parse the output
      const worktrees = stdout
        .trim()
        .split('\n')
        .map(line => {
          const match = line.match(/^(.+?)\s+([a-f0-9]+)\s+\[(.+?)\]$/);
          if (match) {
            return {
              path: match[1].trim(),
              commit: match[2].trim(),
              branch: match[3].trim()
            };
          }
          return null;
        })
        .filter(Boolean) as Worktree[];

      // Enhance with additional info
      const enhancedWorktrees = await Promise.all(
        worktrees.map(wt => this.enhanceWorktreeInfo(wt))
      );

      // Update cache
      this.worktreeCache.set(cacheKey, {
        data: enhancedWorktrees,
        timestamp: Date.now()
      });

      this.updateOperationMetrics(startTime, true);
      return enhancedWorktrees;

    } catch (error) {
      this.updateOperationMetrics(startTime, false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Error getting worktrees', { error: errorMessage });
      throw new Error(`Failed to get worktrees: ${errorMessage}`);
    }
  }

  /**
   * Enhance worktree with additional information
   */
  private async enhanceWorktreeInfo(worktree: Worktree): Promise<Worktree> {
    try {
      // Get last commit info
      const { stdout: lastCommit } = await execAsync(
        `cd "${worktree.path}" && git log -1 --format="%h|%s|%ar|%an" 2>/dev/null || echo ""`
      );
      
      const [commitHash, message, relativeTime, author] = lastCommit.trim().split('|');
      
      // Check for uncommitted changes
      const { stdout: statusOutput } = await execAsync(
        `cd "${worktree.path}" && git status --porcelain 2>/dev/null | wc -l || echo "0"`
      );
      
      const uncommittedChanges = parseInt(statusOutput.trim()) || 0;
      
      // Check if branch is ahead/behind
      const { stdout: branchStatus } = await execAsync(
        `cd "${worktree.path}" && git rev-list --left-right --count HEAD...@{u} 2>/dev/null || echo "0\t0"`
      );
      
      const [ahead, behind] = branchStatus.trim().split('\t').map(n => parseInt(n) || 0);
      
      return {
        ...worktree,
        lastCommit: commitHash ? {
          hash: commitHash,
          message,
          relativeTime,
          author
        } : undefined,
        uncommittedChanges,
        ahead,
        behind,
        needsAttention: uncommittedChanges > 0 || ahead > 0 || behind > 0
      };
    } catch (error) {
      this.logger?.warn('Error enhancing worktree info', { 
        path: worktree.path, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return worktree;
    }
  }

  /**
   * Get all branches with detailed information
   */
  async getBranches(useCache: boolean = true): Promise<{
    branches: Branch[];
    remoteBranches: Branch[];
    currentBranch: string;
  }> {
    await this.ensureInitialized();
    this.lastOperationTime = new Date();
    this.metrics.branchOperations++;
    
    const startTime = Date.now();
    const cacheKey = 'branches';

    try {
      // Check cache first
      if (useCache && this.isCacheValid(this.branchCache, cacheKey)) {
        this.metrics.cacheHits++;
        return this.branchCache.get(cacheKey)!.data;
      }
      this.metrics.cacheMisses++;

      // Get all branches with their last commit info
      const { stdout: branchList } = await execAsync(
        'git branch -a --format="%(refname:short)|%(committerdate:iso)|%(committername)|%(subject)"'
      );
      
      // Get current branch
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const current = currentBranch.trim();
      
      // Get merged branches
      const { stdout: mergedBranches } = await execAsync('git branch --merged');
      const merged = mergedBranches.split('\n').map(b => b.trim().replace('* ', ''));
      
      // Process branch data
      const branches = branchList
        .trim()
        .split('\n')
        .filter(line => line && !line.includes('HEAD'))
        .map(line => {
          const [name, date, author, message] = line.split('|');
          const cleanName = name.replace('remotes/origin/', '');
          const isRemote = name.startsWith('remotes/');
          const isCurrent = cleanName === current;
          const isMerged = merged.includes(cleanName);
          
          return {
            name: cleanName,
            fullName: name,
            isRemote,
            isCurrent,
            isMerged,
            lastCommit: {
              date,
              author,
              message
            }
          };
        });
      
      // Enhance local branches
      const localBranches = branches.filter(b => !b.isRemote);
      const enhancedBranches = await Promise.all(
        localBranches.map(branch => this.enhanceBranchInfo(branch))
      );
      
      const result = {
        branches: enhancedBranches,
        remoteBranches: branches.filter(b => b.isRemote),
        currentBranch: current
      };

      // Update cache
      this.branchCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      this.updateOperationMetrics(startTime, true);
      return result;

    } catch (error) {
      this.updateOperationMetrics(startTime, false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Error getting branches', { error: errorMessage });
      throw new Error(`Failed to get branches: ${errorMessage}`);
    }
  }

  /**
   * Enhance branch with additional information
   */
  private async enhanceBranchInfo(branch: Branch): Promise<Branch> {
    try {
      // Check if branch has upstream
      const { stdout: upstream } = await execAsync(
        `git rev-parse --abbrev-ref ${branch.name}@{upstream} 2>/dev/null || echo ""`
      );
      const hasUpstream = upstream.trim() !== '';
      
      // Get ahead/behind if has upstream
      let ahead = 0, behind = 0;
      if (hasUpstream) {
        const { stdout: counts } = await execAsync(
          `git rev-list --left-right --count ${branch.name}...${branch.name}@{upstream} 2>/dev/null || echo "0\t0"`
        );
        [ahead, behind] = counts.trim().split('\t').map(n => parseInt(n) || 0);
      }
      
      // Calculate age in days
      const lastCommitDate = new Date(branch.lastCommit.date);
      const ageInDays = Math.floor((Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine if branch can be deleted safely
      const canDelete = branch.isMerged && 
                       !branch.isCurrent && 
                       !this.protectedBranches.includes(branch.name);
      
      // Suggest cleanup if old and merged, or very old
      const suggestCleanup = (branch.isMerged && ageInDays > 30) || 
                            (!branch.isMerged && ageInDays > 90);
      
      return {
        ...branch,
        hasUpstream,
        ahead,
        behind,
        ageInDays,
        canDelete,
        suggestCleanup
      };
    } catch (error) {
      return branch;
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<GitCommandResult> {
    await this.ensureInitialized();
    this.lastOperationTime = new Date();
    this.metrics.branchOperations++;
    
    const startTime = Date.now();

    try {
      // Safety check
      if (this.protectedBranches.includes(branchName)) {
        this.updateOperationMetrics(startTime, false);
        return {
          success: false,
          message: 'Cannot delete protected branch',
          error: 'Branch is protected'
        };
      }
      
      // Check if branch exists
      const { stdout: branchExists } = await execAsync(
        `git show-ref --verify --quiet refs/heads/${branchName} && echo "exists" || echo "not found"`
      );
      
      if (branchExists.trim() === 'not found') {
        this.updateOperationMetrics(startTime, false);
        return {
          success: false,
          message: 'Branch not found',
          error: 'Branch does not exist'
        };
      }
      
      // Delete the branch
      const deleteCommand = force ? `git branch -D ${branchName}` : `git branch -d ${branchName}`;
      const { stdout, stderr } = await execAsync(deleteCommand);
      
      if (stderr && stderr.includes('not fully merged')) {
        this.updateOperationMetrics(startTime, false);
        return {
          success: false,
          message: 'Branch not fully merged',
          error: 'Use force delete if you are sure you want to delete this branch'
        };
      }
      
      this.metrics.branchesDeleted++;
      this.clearCaches(); // Invalidate caches
      this.updateOperationMetrics(startTime, true);
      
      return {
        success: true,
        message: `Branch ${branchName} deleted successfully`,
        output: stdout
      };

    } catch (error) {
      this.updateOperationMetrics(startTime, false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Error deleting branch', { branchName, error: errorMessage });
      
      return {
        success: false,
        message: 'Failed to delete branch',
        error: errorMessage
      };
    }
  }

  /**
   * Cleanup multiple branches
   */
  async cleanupBranches(
    branches: string[], 
    dryRun: boolean = true
  ): Promise<{
    dryRun: boolean;
    results: BranchCleanupResult[];
    summary: {
      total: number;
      deleted: number;
      skipped: number;
      errors: number;
    };
  }> {
    await this.ensureInitialized();
    this.lastOperationTime = new Date();
    this.metrics.branchCleanupOperations++;
    
    const startTime = Date.now();
    const results: BranchCleanupResult[] = [];
    
    try {
      for (const branchName of branches) {
        try {
          // Skip protected branches
          if (this.protectedBranches.includes(branchName)) {
            results.push({ 
              branch: branchName, 
              status: 'skipped', 
              reason: 'Protected branch' 
            });
            continue;
          }
          
          if (dryRun) {
            results.push({ 
              branch: branchName, 
              status: 'would-delete', 
              reason: 'Dry run mode' 
            });
          } else {
            const { stdout } = await execAsync(`git branch -d ${branchName}`);
            results.push({ 
              branch: branchName, 
              status: 'deleted', 
              output: stdout.trim() 
            });
            this.metrics.branchesDeleted++;
          }
        } catch (error) {
          results.push({ 
            branch: branchName, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      if (!dryRun) {
        this.clearCaches(); // Invalidate caches after changes
      }
      
      this.updateOperationMetrics(startTime, true);
      
      return {
        dryRun,
        results,
        summary: {
          total: branches.length,
          deleted: results.filter(r => r.status === 'deleted').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          errors: results.filter(r => r.status === 'error').length
        }
      };

    } catch (error) {
      this.updateOperationMetrics(startTime, false);
      throw error;
    }
  }

  /**
   * Execute a whitelisted git command
   */
  async executeCommand(command: string): Promise<GitCommandResult> {
    await this.ensureInitialized();
    this.lastOperationTime = new Date();
    this.metrics.commandExecutions++;
    
    const startTime = Date.now();
    
    const allowedCommands = [
      'git status',
      'git branch',
      'git log --oneline -10',
      'git remote -v',
      'git worktree list'
    ];
    
    if (!allowedCommands.some(allowed => command.startsWith(allowed))) {
      this.updateOperationMetrics(startTime, false);
      return {
        success: false,
        error: 'Command not allowed'
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command);
      this.updateOperationMetrics(startTime, true);
      
      return {
        success: true,
        stdout,
        stderr
      };
    } catch (error) {
      this.updateOperationMetrics(startTime, false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get commits for a specific worktree
   */
  async getWorktreeCommits(
    worktreePath: string, 
    limit: number = 50
  ): Promise<WorktreeCommitsResult> {
    await this.ensureInitialized();
    this.lastOperationTime = new Date();
    this.metrics.commitQueries++;
    
    const startTime = Date.now();
    
    try {
      const decodedPath = decodeURIComponent(worktreePath);
      
      // Get commit hashes first
      const { stdout: hashesOutput } = await execAsync(
        `cd "${decodedPath}" && git log --format="%H" -${limit}`
      );
      
      const hashes = hashesOutput.trim().split('\n').filter(h => h);
      
      // Get detailed info for each commit
      const commits = await Promise.all(
        hashes.map(hash => this.getCommitInfo(decodedPath, hash))
      );
      
      // Get current branch name
      const { stdout: branchName } = await execAsync(
        `cd "${decodedPath}" && git branch --show-current`
      );
      
      this.updateOperationMetrics(startTime, true);
      
      return {
        worktreePath: decodedPath,
        branch: branchName.trim(),
        commits,
        totalCommits: commits.length
      };

    } catch (error) {
      this.updateOperationMetrics(startTime, false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Error getting worktree commits', { worktreePath, error: errorMessage });
      throw new Error(`Failed to get worktree commits: ${errorMessage}`);
    }
  }

  /**
   * Get detailed commit information
   */
  private async getCommitInfo(worktreePath: string, hash: string): Promise<Commit> {
    try {
      // Get basic commit info
      const { stdout: commitInfo } = await execAsync(
        `cd "${worktreePath}" && git log --format="%s|%an|%ae|%ar|%ai" -1 ${hash}`
      );
      
      // Get full commit message to extract task ID
      const { stdout: fullMessage } = await execAsync(
        `cd "${worktreePath}" && git log --format="%B" -1 ${hash}`
      );
      
      const [subject, authorName, authorEmail, relativeTime, date] = commitInfo.trim().split('|');
      
      // Extract task ID from full commit message if present
      const taskIdMatch = fullMessage.match(/Task:\s*#([a-f0-9-]+)/i);
      const taskId = taskIdMatch ? taskIdMatch[1] : null;
      
      return {
        hash,
        subject,
        authorName,
        authorEmail,
        relativeTime,
        date,
        taskId
      };
    } catch (error) {
      this.logger?.warn('Error processing commit', { hash, error: error instanceof Error ? error.message : String(error) });
      return {
        hash,
        subject: 'Error retrieving commit',
        authorName: 'Unknown',
        authorEmail: '',
        relativeTime: 'Unknown',
        date: '',
        taskId: null
      };
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.worktreeCache.clear();
    this.branchCache.clear();
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid<T>(cache: Map<string, { data: T; timestamp: number }>, key: string): boolean {
    const entry = cache.get(key);
    if (!entry) return false;
    
    return (Date.now() - entry.timestamp) < this.cacheTimeout;
  }

  /**
   * Update operation metrics
   */
  private updateOperationMetrics(startTime: number, success: boolean): void {
    const duration = Date.now() - startTime;
    this.metrics.totalOperationTime += duration;
    
    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
      this.metrics.errors++;
    }
    
    const totalOps = this.metrics.successfulOperations + this.metrics.failedOperations;
    this.metrics.averageOperationTime = this.metrics.totalOperationTime / totalOps;
  }
}
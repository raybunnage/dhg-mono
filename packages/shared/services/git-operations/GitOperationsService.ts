import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Worktree {
  path: string;
  commit: string;
  branch: string;
  lastCommit?: {
    hash: string;
    message: string;
    relativeTime: string;
    author: string;
  };
  uncommittedChanges?: number;
  ahead?: number;
  behind?: number;
  needsAttention?: boolean;
}

export interface Branch {
  name: string;
  fullName: string;
  isRemote: boolean;
  isCurrent: boolean;
  isMerged: boolean;
  lastCommit: {
    date: string;
    author: string;
    message: string;
  };
  hasUpstream?: boolean;
  ahead?: number;
  behind?: number;
  ageInDays?: number;
  canDelete?: boolean;
  suggestCleanup?: boolean;
}

export interface Commit {
  hash: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  relativeTime: string;
  date: string;
  taskId?: string | null;
}

export interface BranchCleanupResult {
  branch: string;
  status: 'deleted' | 'skipped' | 'would-delete' | 'error';
  reason?: string;
  output?: string;
  error?: string;
}

/**
 * Service for Git operations
 * Extracted from dhg-admin-code/git-server.cjs
 */
export class GitOperationsService {
  private protectedBranches = ['main', 'master', 'development', 'production'];

  /**
   * Get all git worktrees with enhanced information
   */
  async getWorktrees(): Promise<Worktree[]> {
    const { stdout, stderr } = await execAsync('git worktree list');
    
    if (stderr) {
      console.error('Git worktree error:', stderr);
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
    return Promise.all(worktrees.map(wt => this.enhanceWorktreeInfo(wt)));
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
      console.error(`Error getting info for worktree ${worktree.path}:`, error);
      return worktree;
    }
  }

  /**
   * Get all branches with detailed information
   */
  async getBranches(): Promise<{
    branches: Branch[];
    remoteBranches: Branch[];
    currentBranch: string;
  }> {
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
    
    return {
      branches: enhancedBranches,
      remoteBranches: branches.filter(b => b.isRemote),
      currentBranch: current
    };
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
  async deleteBranch(branchName: string, force: boolean = false): Promise<{
    success: boolean;
    message: string;
    output?: string;
    error?: string;
  }> {
    // Safety check
    if (this.protectedBranches.includes(branchName)) {
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
      return {
        success: false,
        message: 'Branch not found',
        error: 'Branch does not exist'
      };
    }
    
    try {
      // Delete the branch
      const deleteCommand = force ? `git branch -D ${branchName}` : `git branch -d ${branchName}`;
      const { stdout, stderr } = await execAsync(deleteCommand);
      
      if (stderr && stderr.includes('not fully merged')) {
        return {
          success: false,
          message: 'Branch not fully merged',
          error: 'Use force delete if you are sure you want to delete this branch'
        };
      }
      
      return {
        success: true,
        message: `Branch ${branchName} deleted successfully`,
        output: stdout
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete branch',
        error: error instanceof Error ? error.message : 'Unknown error'
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
    const results: BranchCleanupResult[] = [];
    
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
        }
      } catch (error) {
        results.push({ 
          branch: branchName, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
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
  }

  /**
   * Execute a whitelisted git command
   */
  async executeCommand(command: string): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
  }> {
    const allowedCommands = [
      'git status',
      'git branch',
      'git log --oneline -10',
      'git remote -v',
      'git worktree list'
    ];
    
    if (!allowedCommands.some(allowed => command.startsWith(allowed))) {
      return {
        success: false,
        error: 'Command not allowed'
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        success: true,
        stdout,
        stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get commits for a specific worktree
   */
  async getWorktreeCommits(
    worktreePath: string, 
    limit: number = 50
  ): Promise<{
    worktreePath: string;
    branch: string;
    commits: Commit[];
    totalCommits: number;
  }> {
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
    
    return {
      worktreePath: decodedPath,
      branch: branchName.trim(),
      commits,
      totalCommits: commits.length
    };
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
      console.error(`Error processing commit ${hash}:`, error);
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
}
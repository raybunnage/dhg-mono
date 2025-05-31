import { execSync } from 'child_process';

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export interface GitStatus {
  branch: string;
  hasUncommittedChanges: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
}

export class GitService {
  /**
   * Generate a branch name from task details
   */
  generateBranchName(taskId: string, title: string, type: string = 'task'): string {
    // Convert title to kebab-case
    const kebabTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50); // Limit length
    
    // Use first 6 chars of task ID
    const shortId = taskId.substring(0, 6);
    
    return `${type}/${kebabTitle}-${shortId}`;
  }

  /**
   * Create a new branch and switch to it
   */
  async createBranch(branchName: string): Promise<void> {
    try {
      // Create and checkout new branch
      execSync(`git checkout -b ${branchName}`, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Failed to create branch ${branchName}: ${error}`);
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      return branch;
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`);
    }
  }

  /**
   * Get the current commit hash
   */
  async getCurrentCommit(): Promise<string> {
    try {
      const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      return commit;
    } catch (error) {
      throw new Error(`Failed to get current commit: ${error}`);
    }
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(branchName: string): Promise<void> {
    try {
      execSync(`git checkout ${branchName}`, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Failed to switch to branch ${branchName}: ${error}`);
    }
  }

  /**
   * Get commits since a specific commit
   */
  async getCommitsSince(startCommit: string): Promise<GitCommit[]> {
    try {
      const format = '%H|%s|%an|%ad';
      const log = execSync(
        `git log ${startCommit}..HEAD --format="${format}" --date=iso`,
        { encoding: 'utf8' }
      );

      if (!log.trim()) return [];

      return log
        .trim()
        .split('\n')
        .map(line => {
          const [hash, message, author, date] = line.split('|');
          return { hash, message, author, date };
        });
    } catch (error) {
      throw new Error(`Failed to get commits since ${startCommit}: ${error}`);
    }
  }

  /**
   * Get current git status
   */
  async getStatus(): Promise<GitStatus> {
    try {
      const branch = await this.getCurrentBranch();
      
      // Check for uncommitted changes
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      const lines = status.trim().split('\n').filter(line => line);
      
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];
      
      lines.forEach(line => {
        const [status, ...fileParts] = line.trim().split(/\s+/);
        const file = fileParts.join(' ');
        
        if (status === '??') {
          untrackedFiles.push(file);
        } else if (status) {
          modifiedFiles.push(file);
        }
      });

      return {
        branch,
        hasUncommittedChanges: lines.length > 0,
        modifiedFiles,
        untrackedFiles
      };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error}`);
    }
  }

  /**
   * Stash uncommitted changes
   */
  async stashChanges(message: string = 'Auto-stash for task switch'): Promise<void> {
    try {
      execSync(`git stash push -m "${message}"`, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Failed to stash changes: ${error}`);
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      execSync(`git rev-parse --verify ${branchName}`, { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get commit statistics
   */
  async getCommitStats(commitHash: string): Promise<GitCommit> {
    try {
      const stats = execSync(
        `git show --stat --format="%H|%s|%an|%ad" ${commitHash}`,
        { encoding: 'utf8' }
      );

      const lines = stats.trim().split('\n');
      const [hash, message, author, date] = lines[0].split('|');
      
      // Parse the stats line (e.g., "3 files changed, 10 insertions(+), 5 deletions(-)")
      const statsLine = lines[lines.length - 1];
      const statsMatch = statsLine.match(/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?)?(?:,\s+(\d+)\s+deletions?)?/);
      
      return {
        hash,
        message,
        author,
        date,
        filesChanged: statsMatch ? parseInt(statsMatch[1]) : 0,
        insertions: statsMatch && statsMatch[2] ? parseInt(statsMatch[2]) : 0,
        deletions: statsMatch && statsMatch[3] ? parseInt(statsMatch[3]) : 0
      };
    } catch (error) {
      throw new Error(`Failed to get commit stats for ${commitHash}: ${error}`);
    }
  }
}

// Export singleton instance
export const gitService = new GitService();
import { Request, Response } from 'express';
import { ProxyServerBase } from '../../base/ProxyServerBase';
import { ProxyServerConfig } from '../../types';
import { GitOperationsService } from '../../../../packages/shared/services/git-operations/GitOperationsService';

export class GitOperationsProxy extends ProxyServerBase {
  private gitService: GitOperationsService;

  constructor(config?: Partial<ProxyServerConfig>) {
    super({
      name: 'git-operations-proxy',
      port: 9879,
      ...config
    });
    
    this.gitService = new GitOperationsService();
  }

  protected getServiceDescription(): string {
    return 'Git operations and worktree management';
  }

  protected setupRoutes(): void {
    // Worktree endpoints
    this.app.get('/api/git/worktrees', this.handleGetWorktrees.bind(this));
    this.app.post('/api/git/worktree-commits', this.handleGetWorktreeCommits.bind(this));
    
    // Branch endpoints
    this.app.get('/api/git/branches', this.handleGetBranches.bind(this));
    this.app.delete('/api/git/branches/:branchName', this.handleDeleteBranch.bind(this));
    this.app.post('/api/git/cleanup-branches', this.handleCleanupBranches.bind(this));
    
    // Command execution
    this.app.post('/api/git/execute', this.handleExecuteCommand.bind(this));
  }

  /**
   * Get all worktrees with enhanced information
   */
  private async handleGetWorktrees(req: Request, res: Response): Promise<void> {
    try {
      const worktrees = await this.gitService.getWorktrees();
      res.json({ worktrees });
    } catch (error) {
      console.error('Failed to get worktrees:', error);
      res.status(500).json({ 
        error: 'Failed to get worktrees',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get commits for a specific worktree
   */
  private async handleGetWorktreeCommits(req: Request, res: Response): Promise<void> {
    try {
      const { worktreePath } = req.body;
      const limit = parseInt(req.query.limit as string) || 50;
      
      if (!worktreePath) {
        res.status(400).json({ error: 'worktreePath is required' });
        return;
      }
      
      const result = await this.gitService.getWorktreeCommits(worktreePath, limit);
      res.json(result);
    } catch (error) {
      console.error('Failed to get worktree commits:', error);
      res.status(500).json({ 
        error: 'Failed to get worktree commits',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all branches with detailed information
   */
  private async handleGetBranches(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.gitService.getBranches();
      res.json(result);
    } catch (error) {
      console.error('Failed to get branches:', error);
      res.status(500).json({ 
        error: 'Failed to get branches',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a specific branch
   */
  private async handleDeleteBranch(req: Request, res: Response): Promise<void> {
    try {
      const { branchName } = req.params;
      const { force = false } = req.body;
      
      const result = await this.gitService.deleteBranch(branchName, force);
      
      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 : 400;
        res.status(statusCode).json(result);
        return;
      }
      
      res.json(result);
    } catch (error) {
      console.error('Failed to delete branch:', error);
      res.status(500).json({ 
        error: 'Failed to delete branch',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cleanup multiple branches
   */
  private async handleCleanupBranches(req: Request, res: Response): Promise<void> {
    try {
      const { branches = [], dryRun = true } = req.body;
      
      if (!Array.isArray(branches) || branches.length === 0) {
        res.status(400).json({ error: 'No branches provided for cleanup' });
        return;
      }
      
      const result = await this.gitService.cleanupBranches(branches, dryRun);
      res.json(result);
    } catch (error) {
      console.error('Failed to cleanup branches:', error);
      res.status(500).json({ 
        error: 'Failed to cleanup branches',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Execute a whitelisted git command
   */
  private async handleExecuteCommand(req: Request, res: Response): Promise<void> {
    try {
      const { command } = req.body;
      
      if (!command) {
        res.status(400).json({ error: 'Command is required' });
        return;
      }
      
      const result = await this.gitService.executeCommand(command);
      
      if (!result.success) {
        res.status(403).json(result);
        return;
      }
      
      res.json(result);
    } catch (error) {
      console.error('Command execution failed:', error);
      res.status(500).json({ 
        error: 'Command failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
import type { GitBranch } from '../types/git';

const API_BASE_URL = 'http://localhost:3009/api/git';

export class GitApiClient {
  async getAllBranches(): Promise<GitBranch[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/branches`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch branches');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw error;
    }
  }

  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/branches/${encodeURIComponent(branchName)}?force=${force}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete branch');
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  }

  async pruneWorktrees(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/worktrees/prune`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to prune worktrees');
      }
    } catch (error) {
      console.error('Error pruning worktrees:', error);
      throw error;
    }
  }
}
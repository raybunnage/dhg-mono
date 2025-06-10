import type { GitBranch } from '../types/git';
import { CommandExecutionClient } from '@shared/services/command-execution-service';
import { supabase } from '../lib/supabase';

// Create command execution client instance
const commandClient = CommandExecutionClient.getInstance('http://localhost:3009', supabase);

export class GitApiClient {
  async getAllBranches(): Promise<GitBranch[]> {
    try {
      const branches = await commandClient.getGitBranches();
      // Transform to match GitBranch interface if needed
      return branches as any;
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw error;
    }
  }

  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      await commandClient.deleteBranch(branchName, force);
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  }

  async pruneWorktrees(): Promise<void> {
    try {
      await commandClient.pruneWorktrees();
    } catch (error) {
      console.error('Error pruning worktrees:', error);
      throw error;
    }
  }
}
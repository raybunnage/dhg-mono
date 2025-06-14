import type { GitBranch } from '../types/git';
import { CommandExecutionClient } from '@shared/services/browser';
import { supabase } from '../lib/supabase';
import { serverRegistry } from '@shared/services/server-registry-service';

export class GitApiClient {
  private commandClient: CommandExecutionClient | null = null;

  private async getCommandClient(): Promise<CommandExecutionClient> {
    if (!this.commandClient) {
      const gitApiUrl = await serverRegistry.getServerUrl('git-api-server');
      this.commandClient = CommandExecutionClient.getInstance(gitApiUrl, supabase);
    }
    return this.commandClient;
  }
  async getAllBranches(): Promise<GitBranch[]> {
    try {
      const commandClient = await this.getCommandClient();
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
      const commandClient = await this.getCommandClient();
      await commandClient.deleteBranch(branchName, force);
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  }

  async pruneWorktrees(): Promise<void> {
    try {
      const commandClient = await this.getCommandClient();
      await commandClient.pruneWorktrees();
    } catch (error) {
      console.error('Error pruning worktrees:', error);
      throw error;
    }
  }
}
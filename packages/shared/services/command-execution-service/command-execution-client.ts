import { SupabaseClient } from '@supabase/supabase-js';
import {
  CommandResult,
  GitBranchInfo,
  GitWorktreeInfo,
  GitStatusInfo,
  CommandHistory,
  CommandTemplate,
  GIT_COMMAND_TEMPLATES
} from './types';

/**
 * Browser-compatible command execution client that calls the API server
 */
export class CommandExecutionClient {
  private static instance: CommandExecutionClient | null = null;
  private apiBaseUrl: string;
  private supabase: SupabaseClient | null = null;

  private constructor(apiBaseUrl: string = 'http://localhost:3009', supabaseClient?: SupabaseClient) {
    this.apiBaseUrl = apiBaseUrl;
    this.supabase = supabaseClient || null;
  }

  static getInstance(apiBaseUrl?: string, supabaseClient?: SupabaseClient): CommandExecutionClient {
    if (!CommandExecutionClient.instance) {
      CommandExecutionClient.instance = new CommandExecutionClient(apiBaseUrl, supabaseClient);
    }
    return CommandExecutionClient.instance;
  }

  /**
   * Get git branches from API
   */
  async getGitBranches(): Promise<GitBranchInfo[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/git/branches`);
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

  /**
   * Delete a git branch via API
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/git/branches/${encodeURIComponent(branchName)}?force=${force}`,
        { method: 'DELETE' }
      );
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete branch');
      }

      return {
        success: true,
        stdout: `Deleted branch ${branchName}`,
        stderr: '',
        exitCode: 0,
        duration: Date.now() - startTime,
        command: `git branch ${force ? '-D' : '-d'} ${branchName}`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        duration: Date.now() - startTime,
        command: `git branch ${force ? '-D' : '-d'} ${branchName}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Prune worktrees via API
   */
  async pruneWorktrees(): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/git/worktrees/prune`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to prune worktrees');
      }

      return {
        success: true,
        stdout: 'Worktrees pruned successfully',
        stderr: '',
        exitCode: 0,
        duration: Date.now() - startTime,
        command: 'git worktree prune',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        duration: Date.now() - startTime,
        command: 'git worktree prune',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute a custom command via API (if supported)
   */
  async executeCommand(command: string): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/git/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Command execution failed');
      }

      return {
        success: true,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0,
        duration: Date.now() - startTime,
        command,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        duration: Date.now() - startTime,
        command,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get command history from database
   */
  async getCommandHistory(limit: number = 100): Promise<CommandHistory[]> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('command_history')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching command history:', error);
      return [];
    }
  }

  /**
   * Get command templates
   */
  getCommandTemplates(): CommandTemplate[] {
    return Object.values(GIT_COMMAND_TEMPLATES);
  }

  /**
   * Get git status via API
   */
  async getGitStatus(): Promise<GitStatusInfo> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/git/status`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch status');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error fetching git status:', error);
      throw error;
    }
  }

  /**
   * Get worktrees via API
   */
  async getGitWorktrees(): Promise<GitWorktreeInfo[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/git/worktrees`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch worktrees');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error fetching worktrees:', error);
      throw error;
    }
  }

  /**
   * Track command execution in database (client-side)
   */
  async trackCommand(command: string, context: string, result: CommandResult): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase
        .from('command_history')
        .insert({
          command,
          context,
          success: result.success,
          stdout: result.stdout.substring(0, 10000), // Limit size
          stderr: result.stderr.substring(0, 10000),
          exit_code: result.exitCode,
          duration_ms: result.duration,
          executed_at: result.timestamp
        });
    } catch (error) {
      console.error('Error tracking command:', error);
    }
  }
}
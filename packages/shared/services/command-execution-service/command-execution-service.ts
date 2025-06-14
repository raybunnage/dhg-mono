import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  CommandResult,
  CommandOptions,
  GitCommandResult,
  CommandHistory,
  CommandTemplate,
  GitBranchInfo,
  GitWorktreeInfo,
  GitStatusInfo,
  GitCommitInfo,
  GIT_COMMAND_TEMPLATES
} from './types';

const execAsync = promisify(exec);

export class CommandExecutionService {
  private static instance: CommandExecutionService | null = null;
  private supabase: SupabaseClient | null = null;
  private defaultTimeout = 30000; // 30 seconds

  private constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || null;
  }

  static getInstance(supabaseClient?: SupabaseClient): CommandExecutionService {
    if (!CommandExecutionService.instance) {
      CommandExecutionService.instance = new CommandExecutionService(supabaseClient);
    }
    return CommandExecutionService.instance;
  }

  /**
   * Execute a shell command
   */
  async executeCommand(command: string, options: CommandOptions = {}): Promise<CommandResult> {
    const startTime = Date.now();
    const timeout = options.timeout || this.defaultTimeout;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        encoding: options.encoding || 'utf8',
        timeout,
        shell: options.shell !== false
      });

      const result: CommandResult = {
        success: true,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        duration: Date.now() - startTime,
        command,
        timestamp: new Date().toISOString()
      };

      // Track command if Supabase is available
      if (this.supabase) {
        await this.trackCommand(command, options.cwd || process.cwd(), result);
      }

      return result;
    } catch (error: any) {
      const result: CommandResult = {
        success: false,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1,
        duration: Date.now() - startTime,
        command,
        timestamp: new Date().toISOString()
      };

      // Track failed command too
      if (this.supabase) {
        await this.trackCommand(command, options.cwd || process.cwd(), result);
      }

      return result;
    }
  }

  /**
   * Execute a command with streaming output
   */
  async executeCommandStreaming(
    command: string,
    onData: (data: string) => void,
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const [cmd, ...args] = command.split(' ');
      
      const child = spawn(cmd, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        shell: options.shell !== false
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        onData(chunk);
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        onData(`[stderr] ${chunk}`);
      });

      child.on('close', (code) => {
        const result: CommandResult = {
          success: code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
          duration: Date.now() - startTime,
          command,
          timestamp: new Date().toISOString()
        };

        if (this.supabase) {
          this.trackCommand(command, options.cwd || process.cwd(), result);
        }

        resolve(result);
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          child.kill();
        }, options.timeout);
      }
    });
  }

  /**
   * Execute a Git command and parse the output
   */
  async executeGitCommand(command: string, options: CommandOptions = {}): Promise<GitCommandResult> {
    const result = await this.executeCommand(`git ${command}`, options);
    
    const gitResult: GitCommandResult = {
      ...result,
      parsed: null
    };

    // Parse based on command type
    if (command.startsWith('status')) {
      gitResult.parsed = this.parseGitStatus(result.stdout);
    } else if (command.includes('branch')) {
      gitResult.parsed = this.parseGitBranches(result.stdout);
    } else if (command.includes('worktree list')) {
      gitResult.parsed = this.parseGitWorktrees(result.stdout);
    } else if (command.startsWith('log')) {
      gitResult.parsed = this.parseGitLog(result.stdout);
    }

    return gitResult;
  }

  /**
   * Track command execution in database
   */
  private async trackCommand(command: string, context: string, result: CommandResult): Promise<void> {
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

  /**
   * Get command history
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
   * Parse git status output
   */
  private parseGitStatus(output: string): GitStatusInfo {
    const lines = output.trim().split('\n').filter(line => line);
    const status: GitStatusInfo = {
      branch: '',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
      conflicted: [],
      clean: lines.length === 0
    };

    lines.forEach(line => {
      const code = line.substring(0, 2);
      const file = line.substring(3);

      if (code === '??') status.untracked.push(file);
      else if (code === 'UU') status.conflicted.push(file);
      else if (code[0] !== ' ') status.staged.push(file);
      else if (code[1] !== ' ') status.modified.push(file);
    });

    return status;
  }

  /**
   * Parse git branch output
   */
  private parseGitBranches(output: string): GitBranchInfo[] {
    const lines = output.trim().split('\n').filter(line => line);
    const branches: GitBranchInfo[] = [];

    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 5) {
        const [name, isCurrent, upstream, date, author, ...messageParts] = parts;
        branches.push({
          name: name.trim(),
          current: isCurrent === '*',
          remote: name.includes('origin/'),
          commit: '',
          author: author.trim(),
          date: date.trim(),
          message: messageParts.join('|').trim(),
          upstream: upstream.trim() || undefined
        });
      }
    });

    return branches;
  }

  /**
   * Parse git worktree output
   */
  private parseGitWorktrees(output: string): GitWorktreeInfo[] {
    const worktrees: GitWorktreeInfo[] = [];
    let current: Partial<GitWorktreeInfo> = {};

    output.split('\n').forEach(line => {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as GitWorktreeInfo);
        }
        current = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        current.commit = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7);
      } else if (line === 'bare') {
        current.bare = true;
      } else if (line === 'detached') {
        current.detached = true;
      } else if (line.startsWith('locked ')) {
        current.locked = line.substring(7);
      } else if (line.startsWith('prunable ')) {
        current.prunable = line.substring(9);
      }
    });

    if (current.path) {
      worktrees.push(current as GitWorktreeInfo);
    }

    return worktrees;
  }

  /**
   * Parse git log output
   */
  private parseGitLog(output: string): GitCommitInfo[] {
    const lines = output.trim().split('\n').filter(line => line);
    const commits: GitCommitInfo[] = [];

    // Simple parsing for --oneline format
    lines.forEach(line => {
      const match = line.match(/^(\w+)\s+(.+)$/);
      if (match) {
        commits.push({
          hash: match[1],
          abbreviatedHash: match[1],
          author: '',
          authorEmail: '',
          date: '',
          message: match[2],
          refs: []
        });
      }
    });

    return commits;
  }

  /**
   * Get command templates
   */
  getCommandTemplates(): CommandTemplate[] {
    return Object.values(GIT_COMMAND_TEMPLATES);
  }

  /**
   * Execute a command template
   */
  async executeTemplate(
    templateId: string,
    parameters: Record<string, any> = {},
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    const template = GIT_COMMAND_TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Replace parameters in template
    let command = template.template;
    template.parameters.forEach(param => {
      const value = parameters[param.name] ?? param.default;
      if (param.required && value === undefined) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }
      command = command.replace(`{${param.name}}`, value);
    });

    return this.executeCommand(command, options);
  }

  /**
   * Common Git operations
   */
  async getGitStatus(cwd?: string): Promise<GitStatusInfo> {
    const result = await this.executeGitCommand('status --porcelain=v1', { cwd });
    return result.parsed || this.parseGitStatus(result.stdout);
  }

  async getGitBranches(cwd?: string): Promise<GitBranchInfo[]> {
    const result = await this.executeGitCommand(
      'branch -a --format="%(refname:short)|%(HEAD)|%(upstream:short)|%(committerdate:iso)|%(authorname)|%(subject)"',
      { cwd }
    );
    return result.parsed || this.parseGitBranches(result.stdout);
  }

  async getGitWorktrees(cwd?: string): Promise<GitWorktreeInfo[]> {
    const result = await this.executeGitCommand('worktree list --porcelain', { cwd });
    return result.parsed || this.parseGitWorktrees(result.stdout);
  }

  async checkoutBranch(branch: string, cwd?: string): Promise<CommandResult> {
    return this.executeGitCommand(`checkout ${branch}`, { cwd });
  }

  async createBranch(branch: string, cwd?: string): Promise<CommandResult> {
    return this.executeGitCommand(`checkout -b ${branch}`, { cwd });
  }

  async deleteBranch(branch: string, force: boolean = false, cwd?: string): Promise<CommandResult> {
    const flag = force ? '-D' : '-d';
    return this.executeGitCommand(`branch ${flag} ${branch}`, { cwd });
  }

  async pullChanges(branch?: string, cwd?: string): Promise<CommandResult> {
    const cmd = branch ? `pull origin ${branch}` : 'pull';
    return this.executeGitCommand(cmd, { cwd });
  }

  async pushChanges(branch?: string, cwd?: string): Promise<CommandResult> {
    const cmd = branch ? `push origin ${branch}` : 'push';
    return this.executeGitCommand(cmd, { cwd });
  }

  async stashChanges(message?: string, cwd?: string): Promise<CommandResult> {
    const cmd = message ? `stash save "${message}"` : 'stash';
    return this.executeGitCommand(cmd, { cwd });
  }

  async addWorktree(path: string, branch: string, cwd?: string): Promise<CommandResult> {
    return this.executeGitCommand(`worktree add ${path} ${branch}`, { cwd });
  }

  async removeWorktree(path: string, force: boolean = false, cwd?: string): Promise<CommandResult> {
    const flag = force ? '--force' : '';
    return this.executeGitCommand(`worktree remove ${flag} ${path}`, { cwd });
  }

  async pruneWorktrees(cwd?: string): Promise<CommandResult> {
    return this.executeGitCommand('worktree prune', { cwd });
  }
}
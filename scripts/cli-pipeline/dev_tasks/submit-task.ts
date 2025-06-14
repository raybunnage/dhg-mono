#!/usr/bin/env ts-node

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const program = new Command();
const supabase = SupabaseClientService.getInstance().getClient();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function getCurrentWorktree(): Promise<string> {
  try {
    const gitDir = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const worktreeName = path.basename(gitDir);
    return worktreeName;
  } catch (error) {
    return 'unknown';
  }
}

async function getUncommittedFiles(): Promise<string[]> {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.split('\n').filter(line => line.trim()).map(line => line.substring(3));
  } catch (error) {
    return [];
  }
}

async function checkSyncStatus(): Promise<{ behindCount: number; branch: string }> {
  try {
    // Get current branch
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    
    // Fetch latest from origin
    execSync('git fetch origin development', { encoding: 'utf8' });
    
    // Check how many commits behind we are
    const behindCount = execSync('git rev-list --count HEAD..origin/development', { encoding: 'utf8' }).trim();
    
    return { behindCount: parseInt(behindCount) || 0, branch };
  } catch (error) {
    return { behindCount: 0, branch: 'unknown' };
  }
}

async function submitTask(taskId: string, rawTask: string, options: any) {
  try {
    console.log(`${colors.blue}📝 Submitting task to Claude...${colors.reset}`);

    // Check sync status first (unless disabled)
    if (options.syncCheck !== false) {
      const { behindCount, branch } = await checkSyncStatus();
      
      if (behindCount > 0) {
        console.log(`\n${colors.yellow}⚠️  WARNING: Your branch '${branch}' is ${behindCount} commit(s) behind origin/development${colors.reset}`);
        console.log(`${colors.yellow}📋 Remember to sync with development before starting work:${colors.reset}`);
        console.log(`   git merge origin/development`);
        console.log(`   git push origin ${branch}\n`);
        console.log(`${colors.cyan}ℹ️  Use the clipboard snippet "Dev Task Submission - Sync with Development First" for the complete workflow${colors.reset}\n`);
      }
    }

    // Get current worktree if not specified
    const worktree = options.worktree || await getCurrentWorktree();
    
    // Get uncommitted files for recovery notes
    const uncommittedFiles = await getUncommittedFiles();
    const recoveryNotes = uncommittedFiles.length > 0 
      ? `Uncommitted files at submission:\n${uncommittedFiles.join('\n')}`
      : null;

    // Call the database function to submit the task
    const { data, error } = await supabase
      .rpc('submit_task_to_claude', {
        p_task_id: taskId,
        p_raw_task: rawTask,
        p_worktree: worktree
      });

    if (error) {
      console.error(`${colors.red}❌ Error submitting task:${colors.reset}`, error);
      process.exit(1);
    }

    console.log(`${colors.green}✅ Task submitted successfully!${colors.reset}`);
    console.log(`${colors.cyan}📋 Task ID: ${data.task_id}${colors.reset}`);
    console.log(`${colors.cyan}🆔 Submission ID: ${data.submission_id}${colors.reset}`);
    console.log(`${colors.cyan}🌳 Worktree: ${data.worktree}${colors.reset}`);
    console.log(`${colors.cyan}⏰ Timestamp: ${new Date(data.timestamp).toLocaleString()}${colors.reset}`);

    // Update with recovery notes if we have uncommitted files
    if (recoveryNotes) {
      await supabase
        .rpc('update_claude_activity', {
          p_task_id: taskId,
          p_status: 'processing',
          p_recovery_notes: recoveryNotes
        });
    }

    // Save submission info to a local file for easy recovery
    const submissionInfo = {
      taskId,
      submissionId: data.submission_id,
      worktree: data.worktree,
      timestamp: data.timestamp,
      rawTask,
      uncommittedFiles
    };

    const submissionFile = path.join(process.cwd(), `.claude-submission-${taskId}.json`);
    fs.writeFileSync(submissionFile, JSON.stringify(submissionInfo, null, 2));
    console.log(`${colors.yellow}💾 Submission saved to: ${submissionFile}${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Unexpected error:${colors.reset}`, error);
    process.exit(1);
  }
}

async function submitFromFile(taskId: string, filePath: string, options: any) {
  try {
    const rawTask = fs.readFileSync(filePath, 'utf8');
    await submitTask(taskId, rawTask, options);
  } catch (error) {
    console.error(`${colors.red}❌ Error reading file:${colors.reset}`, error);
    process.exit(1);
  }
}

async function submitFromStdin(taskId: string, options: any) {
  return new Promise<void>((resolve, reject) => {
    let rawTask = '';
    
    process.stdin.on('data', (chunk) => {
      rawTask += chunk;
    });
    
    process.stdin.on('end', async () => {
      if (rawTask.trim()) {
        await submitTask(taskId, rawTask, options);
        resolve();
      } else {
        console.error(`${colors.red}❌ No task content provided${colors.reset}`);
        reject();
      }
    });
    
    process.stdin.on('error', reject);
  });
}

// Main command setup
program
  .name('submit-task')
  .description('Submit a task to Claude Code and track it in the database')
  .argument('<task-id>', 'The task ID to submit')
  .option('-f, --file <path>', 'Read task from file')
  .option('-t, --text <text>', 'Provide task text directly')
  .option('-w, --worktree <name>', 'Specify worktree (defaults to current)')
  .option('--stdin', 'Read task from stdin')
  .option('--no-sync-check', 'Skip sync status check')
  .action(async (taskId, options) => {
    if (options.file) {
      await submitFromFile(taskId, options.file, options);
    } else if (options.text) {
      await submitTask(taskId, options.text, options);
    } else if (options.stdin) {
      await submitFromStdin(taskId, options);
    } else {
      console.error(`${colors.red}❌ You must provide task content via --file, --text, or --stdin${colors.reset}`);
      process.exit(1);
    }
  });

// Recovery command
program
  .command('recover [worktree]')
  .description('Find and recover interrupted Claude tasks')
  .option('-m, --minutes <minutes>', 'Timeout in minutes (default: 30)', '30')
  .action(async (worktree, options) => {
    console.log(`${colors.blue}🔍 Looking for interrupted tasks...${colors.reset}`);
    
    const { data, error } = await supabase
      .rpc('get_interrupted_claude_tasks', {
        p_worktree: worktree || null,
        p_timeout_minutes: parseInt(options.minutes)
      });

    if (error) {
      console.error(`${colors.red}❌ Error finding tasks:${colors.reset}`, error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log(`${colors.green}✅ No interrupted tasks found${colors.reset}`);
      return;
    }

    console.log(`${colors.yellow}⚠️  Found ${data.length} interrupted task(s):${colors.reset}\n`);
    
    data.forEach((task: any) => {
      console.log(`${colors.bright}Task: ${task.title}${colors.reset}`);
      console.log(`  ID: ${task.task_id}`);
      console.log(`  Worktree: ${task.worktree}`);
      console.log(`  Inactive for: ${task.minutes_inactive} minutes`);
      if (task.recovery_notes) {
        console.log(`  Recovery notes:\n${task.recovery_notes.split('\n').map((l: string) => '    ' + l).join('\n')}`);
      }
      console.log(`  Raw task preview:\n    ${task.raw_task.substring(0, 200)}...`);
      console.log();
    });
  });

// Update activity command (for manual tracking)
program
  .command('update-activity <task-id>')
  .description('Update the activity timestamp for a Claude submission')
  .option('-s, --status <status>', 'Update status (processing, interrupted, completed, failed)')
  .option('-n, --notes <notes>', 'Add recovery notes')
  .action(async (taskId, options) => {
    const { error } = await supabase
      .rpc('update_claude_activity', {
        p_task_id: taskId,
        p_status: options.status || 'processing',
        p_recovery_notes: options.notes || null
      });

    if (error) {
      console.error(`${colors.red}❌ Error updating activity:${colors.reset}`, error);
      process.exit(1);
    }

    console.log(`${colors.green}✅ Activity updated${colors.reset}`);
  });

program.parse(process.argv);